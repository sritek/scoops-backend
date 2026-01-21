import { prisma } from "../../config/database.js";
import { createModuleLogger } from "../../config/logger.js";
import { emitEvents, EVENT_TYPES } from "../../modules/events/event-emitter.js";
import type { JobResult } from "../job-tracker.js";
import { updateInstallmentStatuses } from "../../modules/installments/installments.service.js";

const log = createModuleLogger("fee-reminder-job");

/**
 * Fee Reminder Job
 * 
 * Sends reminders for:
 * 1. New installments (FeeInstallment) that are due in X days
 * 2. Legacy fees (StudentFee) for backward compatibility
 * 
 * Also updates installment statuses (upcoming -> due -> overdue)
 * 
 * Runs daily at 8 AM.
 * 
 * @returns JobResult with processing stats
 */
export async function sendFeeRemindersJob(): Promise<JobResult> {
  // First, update installment statuses based on due dates
  try {
    await updateInstallmentStatuses();
    log.debug("Updated installment statuses");
  } catch (error) {
    log.error({ error }, "Failed to update installment statuses");
  }

  // Check for upcoming installments
  const maxReminderWindow = new Date();
  maxReminderWindow.setDate(maxReminderWindow.getDate() + 30);

  const upcomingInstallmentsCount = await prisma.feeInstallment.count({
    where: {
      dueDate: {
        gte: new Date(),
        lte: maxReminderWindow,
      },
      status: {
        in: ["upcoming", "due", "partial"],
      },
      studentFeeStructure: {
        student: {
          status: "active",
        },
      },
    },
  });

  // Also check legacy StudentFee records
  const upcomingLegacyFeesCount = await prisma.studentFee.count({
    where: {
      dueDate: {
        gte: new Date(),
        lte: maxReminderWindow,
      },
      status: {
        in: ["pending", "partial"],
      },
      student: {
        status: "active",
      },
    },
  });

  const totalUpcoming = upcomingInstallmentsCount + upcomingLegacyFeesCount;

  if (totalUpcoming === 0) {
    log.debug("No upcoming fees/installments in next 30 days, skipping fee reminder job");
    return { skipped: true, metadata: { reason: "No upcoming fees in next 30 days" } };
  }

  log.debug({ upcomingInstallmentsCount, upcomingLegacyFeesCount }, "Found upcoming fees, processing reminders");

  // Get orgs with notifications enabled
  const orgs = await prisma.organization.findMany({
    where: {
      notificationsEnabled: true,
    },
    select: {
      id: true,
      name: true,
      feeReminderDays: true,
      branches: {
        select: {
          id: true,
        },
      },
    },
  });

  if (orgs.length === 0) {
    log.debug("No organizations with notifications enabled");
    return { skipped: true, metadata: { reason: "No orgs with notifications enabled" } };
  }

  let totalEventsEmitted = 0;
  let installmentReminders = 0;
  let legacyReminders = 0;

  for (const org of orgs) {
    // Calculate the target due date (today + reminderDays)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + org.feeReminderDays);
    targetDate.setHours(0, 0, 0, 0);

    const targetDateEnd = new Date(targetDate);
    targetDateEnd.setHours(23, 59, 59, 999);

    log.debug(
      {
        orgId: org.id,
        orgName: org.name,
        reminderDays: org.feeReminderDays,
        targetDate: targetDate.toISOString().split("T")[0],
      },
      "Checking fees for reminders"
    );

    for (const branch of org.branches) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // =====================
      // Process NEW installments (FeeInstallment)
      // =====================
      const upcomingInstallments = await prisma.feeInstallment.findMany({
        where: {
          studentFeeStructure: {
            student: {
              orgId: org.id,
              branchId: branch.id,
              status: "active",
            },
          },
          dueDate: {
            gte: targetDate,
            lte: targetDateEnd,
          },
          status: {
            in: ["upcoming", "due", "partial"],
          },
        },
        include: {
          studentFeeStructure: {
            include: {
              student: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  studentParents: {
                    where: {
                      isPrimaryContact: true,
                    },
                    include: {
                      parent: {
                        select: {
                          id: true,
                          phone: true,
                        },
                      },
                    },
                  },
                },
              },
              session: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      if (upcomingInstallments.length > 0) {
        // Check for existing reminders sent today
        const existingReminders = await prisma.feeReminder.findMany({
          where: {
            installmentId: {
              in: upcomingInstallments.map((i) => i.id),
            },
            sentAt: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
          select: {
            installmentId: true,
          },
        });

        const remindedInstallmentIds = new Set(existingReminders.map((r) => r.installmentId));

        // Filter installments not yet reminded today
        const installmentsToRemind = upcomingInstallments.filter(
          (inst) => !remindedInstallmentIds.has(inst.id)
        );

        // Create reminder events for each installment
        const events = [];
        for (const inst of installmentsToRemind) {
          const primaryParent = inst.studentFeeStructure.student.studentParents[0]?.parent;
          
          if (!primaryParent) {
            log.debug({ studentId: inst.studentFeeStructure.student.id }, "No primary parent found, skipping reminder");
            continue;
          }

          // Create FeeReminder record
          await prisma.feeReminder.create({
            data: {
              installmentId: inst.id,
              parentId: primaryParent.id,
              channel: "whatsapp",
              status: "pending",
            },
          });

          // Update reminder count on installment
          await prisma.feeInstallment.update({
            where: { id: inst.id },
            data: {
              reminderCount: { increment: 1 },
              reminderSentAt: new Date(),
            },
          });

          events.push({
            type: EVENT_TYPES.FEE_REMINDER,
            orgId: org.id,
            branchId: branch.id,
            payload: {
              entityType: "fee_installment",
              entityId: inst.id,
              data: {
                studentId: inst.studentFeeStructure.student.id,
                studentName: `${inst.studentFeeStructure.student.firstName} ${inst.studentFeeStructure.student.lastName}`,
                sessionName: inst.studentFeeStructure.session.name,
                installmentNumber: inst.installmentNumber,
                amount: inst.amount,
                paidAmount: inst.paidAmount,
                pendingAmount: inst.amount - inst.paidAmount,
                dueDate: inst.dueDate.toISOString().split("T")[0],
                daysUntilDue: org.feeReminderDays,
                parentPhone: primaryParent.phone,
              },
            },
          });
        }

        if (events.length > 0) {
          const count = await emitEvents(events);
          totalEventsEmitted += count;
          installmentReminders += count;

          log.debug(
            { orgId: org.id, branchId: branch.id, count },
            "Emitted installment reminder events"
          );
        }
      }

      // =====================
      // Process LEGACY fees (StudentFee) - for backward compatibility
      // =====================
      const upcomingFees = await prisma.studentFee.findMany({
        where: {
          student: {
            orgId: org.id,
            branchId: branch.id,
            status: "active",
          },
          dueDate: {
            gte: targetDate,
            lte: targetDateEnd,
          },
          status: {
            in: ["pending", "partial"],
          },
        },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          feePlan: {
            select: {
              name: true,
            },
          },
        },
      });

      if (upcomingFees.length > 0) {
        // Check for existing reminder events
        const existingEvents = await prisma.event.findMany({
          where: {
            orgId: org.id,
            branchId: branch.id,
            type: "fee_reminder",
            createdAt: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
          select: {
            payload: true,
          },
        });

        const existingFeeIds = new Set<string>();
        for (const event of existingEvents) {
          try {
            const payload = JSON.parse(event.payload);
            if (payload.entityId && payload.entityType === "student_fee") {
              existingFeeIds.add(payload.entityId);
            }
          } catch {
            // Skip malformed payloads
          }
        }

        const feesToRemind = upcomingFees.filter(
          (fee) => !existingFeeIds.has(fee.id)
        );

        if (feesToRemind.length > 0) {
          const events = feesToRemind.map((fee) => ({
            type: EVENT_TYPES.FEE_REMINDER,
            orgId: org.id,
            branchId: branch.id,
            payload: {
              entityType: "student_fee",
              entityId: fee.id,
              data: {
                studentId: fee.student.id,
                studentName: `${fee.student.firstName} ${fee.student.lastName}`,
                feePlanName: fee.feePlan.name,
                totalAmount: fee.totalAmount,
                paidAmount: fee.paidAmount,
                pendingAmount: fee.totalAmount - fee.paidAmount,
                dueDate: fee.dueDate.toISOString().split("T")[0],
                daysUntilDue: org.feeReminderDays,
              },
            },
          }));

          const count = await emitEvents(events);
          totalEventsEmitted += count;
          legacyReminders += count;

          log.debug(
            { orgId: org.id, branchId: branch.id, count },
            "Emitted legacy fee reminder events"
          );
        }
      }
    }
  }

  if (totalEventsEmitted > 0) {
    log.info(
      { totalEvents: totalEventsEmitted, installmentReminders, legacyReminders },
      "Fee reminder job completed"
    );
  }

  if (totalEventsEmitted === 0) {
    return { skipped: true, metadata: { reason: "No new reminder events to emit" } };
  }

  return {
    eventsEmitted: totalEventsEmitted,
    metadata: { 
      upcomingFeesChecked: totalUpcoming,
      installmentReminders,
      legacyReminders,
    },
  };
}
