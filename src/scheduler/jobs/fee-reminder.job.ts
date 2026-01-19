import { prisma } from "../../config/database.js";
import { createModuleLogger } from "../../config/logger.js";
import { emitEvents, EVENT_TYPES } from "../../modules/events/event-emitter.js";
import type { JobResult } from "../job-tracker.js";

const log = createModuleLogger("fee-reminder-job");

/**
 * Fee Reminder Job
 * 
 * Sends reminders for fees that are due in X days (configurable per org).
 * Runs daily at 8 AM.
 * Only emits events once per fee for the reminder period.
 * 
 * @returns JobResult with processing stats
 */
export async function sendFeeRemindersJob(): Promise<JobResult> {
  // Early exit: Check if there are ANY pending fees due in the next 30 days
  const maxReminderWindow = new Date();
  maxReminderWindow.setDate(maxReminderWindow.getDate() + 30);

  const upcomingFeesCount = await prisma.studentFee.count({
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

  if (upcomingFeesCount === 0) {
    log.debug("No upcoming fees in next 30 days, skipping fee reminder job");
    return { skipped: true, metadata: { reason: "No upcoming fees in next 30 days" } };
  }

    log.debug({ upcomingFeesCount }, "Found upcoming fees, processing reminders");

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
        // Find fees due on the target date
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

        if (upcomingFees.length === 0) {
          continue;
        }

        // Check for existing reminder events for these fees
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

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
            if (payload.entityId) {
              existingFeeIds.add(payload.entityId);
            }
          } catch {
            // Skip malformed payloads
          }
        }

        // Filter to fees that haven't been reminded today
        const feesToRemind = upcomingFees.filter(
          (fee) => !existingFeeIds.has(fee.id)
        );

        if (feesToRemind.length === 0) {
          continue;
        }

        // Create reminder events
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

        log.debug(
          { orgId: org.id, branchId: branch.id, count },
          "Emitted fee reminder events"
        );
      }
    }

  if (totalEventsEmitted > 0) {
    log.info(
      { totalEvents: totalEventsEmitted },
      "Fee reminder job completed"
    );
  }

  if (totalEventsEmitted === 0) {
    return { skipped: true, metadata: { reason: "No new reminder events to emit" } };
  }

  return {
    eventsEmitted: totalEventsEmitted,
    metadata: { upcomingFeesChecked: upcomingFeesCount },
  };
}
