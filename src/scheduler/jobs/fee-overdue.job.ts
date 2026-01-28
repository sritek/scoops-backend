import { prisma } from "../../config/database.js";
import { createModuleLogger } from "../../config/logger.js";
import { emitEvents, EVENT_TYPES } from "../../modules/events/event-emitter.js";
import type { JobResult } from "../job-tracker.js";

const log = createModuleLogger("fee-overdue-job");

/**
 * Fee Overdue Job
 *
 * Checks for overdue fee installments and emits fee_overdue events.
 * Runs hourly and checks each org's configured feeOverdueCheckTime.
 * Only emits events once per day per installment (uses Event table for dedup).
 *
 * @returns JobResult with processing stats
 */
export async function checkOverdueFeesJob(): Promise<JobResult> {
  // Today at midnight (for date comparison)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Early exit: Check if there are ANY overdue installments globally
  const overdueInstallmentsCount = await prisma.feeInstallment.count({
    where: {
      dueDate: {
        lt: today,
      },
      status: {
        in: ["due", "partial", "overdue"],
      },
      studentFeeStructure: {
        student: {
          status: "active",
        },
      },
    },
  });

  if (overdueInstallmentsCount === 0) {
    log.debug("No overdue installments found, skipping fee overdue job");
    return {
      skipped: true,
      metadata: { reason: "No overdue installments found" },
    };
  }

  log.debug(
    { overdueInstallmentsCount },
    "Found overdue installments, checking org schedules",
  );

  const now = new Date();
  const currentHour = now.getHours();

  // Get orgs where we should run the check this hour
  const orgs = await prisma.organization.findMany({
    where: {
      notificationsEnabled: true,
    },
    select: {
      id: true,
      name: true,
      feeOverdueCheckTime: true,
      branches: {
        select: {
          id: true,
        },
      },
    },
  });

  if (orgs.length === 0) {
    log.debug("No organizations with notifications enabled");
    return {
      skipped: true,
      metadata: { reason: "No orgs with notifications enabled" },
    };
  }

  let totalEventsEmitted = 0;

  for (const org of orgs) {
    // Check if it's time to run for this org
    const configuredHour = parseInt(org.feeOverdueCheckTime.split(":")[0], 10);
    if (currentHour !== configuredHour) {
      continue;
    }

    log.debug(
      { orgId: org.id, orgName: org.name },
      "Checking overdue installments for organization",
    );

    for (const branch of org.branches) {
      // Find overdue installments that haven't been notified today
      const overdueInstallments = await prisma.feeInstallment.findMany({
        where: {
          studentFeeStructure: {
            student: {
              orgId: org.id,
              branchId: branch.id,
              status: "active",
            },
          },
          dueDate: {
            lt: today, // Due date is before today
          },
          status: {
            in: ["due", "partial", "overdue"],
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

      if (overdueInstallments.length === 0) {
        continue;
      }

      // Check which installments haven't been notified today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // Get today's fee_overdue events to prevent duplicates
      const existingEvents = await prisma.event.findMany({
        where: {
          orgId: org.id,
          branchId: branch.id,
          type: "fee_overdue",
          createdAt: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
        select: {
          payload: true,
        },
      });

      // Extract entity IDs that already have events today
      const existingInstallmentIds = new Set<string>();
      for (const event of existingEvents) {
        try {
          const payload = JSON.parse(event.payload);
          if (payload.entityId) {
            existingInstallmentIds.add(payload.entityId);
          }
        } catch {
          // Skip malformed payloads
        }
      }

      // Filter to only installments that haven't been notified
      const installmentsToNotify = overdueInstallments.filter(
        (inst) => !existingInstallmentIds.has(inst.id),
      );

      if (installmentsToNotify.length === 0) {
        continue;
      }

      // Create events for overdue installments
      const events = installmentsToNotify.map((inst) => ({
        type: EVENT_TYPES.FEE_OVERDUE,
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
            daysOverdue: Math.floor(
              (today.getTime() - inst.dueDate.getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          },
        },
      }));

      const count = await emitEvents(events);
      totalEventsEmitted += count;

      log.debug(
        { orgId: org.id, branchId: branch.id, count },
        "Emitted fee overdue events",
      );
    }
  }

  if (totalEventsEmitted > 0) {
    log.info({ totalEvents: totalEventsEmitted }, "Fee overdue job completed");
  }

  if (totalEventsEmitted === 0) {
    return {
      skipped: true,
      metadata: { reason: "No new overdue events to emit" },
    };
  }

  return {
    eventsEmitted: totalEventsEmitted,
    metadata: { overdueInstallmentsChecked: overdueInstallmentsCount },
  };
}
