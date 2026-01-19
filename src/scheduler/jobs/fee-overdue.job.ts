import { prisma } from "../../config/database.js";
import { createModuleLogger } from "../../config/logger.js";
import { emitEvents, EVENT_TYPES } from "../../modules/events/event-emitter.js";
import type { JobResult } from "../job-tracker.js";

const log = createModuleLogger("fee-overdue-job");

/**
 * Fee Overdue Job
 * 
 * Checks for overdue fees and emits fee_overdue events.
 * Runs hourly and checks each org's configured feeOverdueCheckTime.
 * Only emits events once per day per fee (uses NotificationLog for dedup).
 * 
 * @returns JobResult with processing stats
 */
export async function checkOverdueFeesJob(): Promise<JobResult> {
  // Today at midnight (for date comparison)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Early exit: Check if there are ANY overdue fees globally
  const overdueFeesCount = await prisma.studentFee.count({
    where: {
      dueDate: {
        lt: today,
      },
      status: {
        in: ["pending", "partial"],
      },
      student: {
        status: "active",
      },
    },
  });

  if (overdueFeesCount === 0) {
    log.debug("No overdue fees found, skipping fee overdue job");
    return { skipped: true, metadata: { reason: "No overdue fees found" } };
  }

    log.debug({ overdueFeesCount }, "Found overdue fees, checking org schedules");

    const now = new Date();
    const currentHour = now.getHours();

    // Get orgs where we should run the check this hour
    // Check if current time is within the configured hour
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
    return { skipped: true, metadata: { reason: "No orgs with notifications enabled" } };
  }

    let totalEventsEmitted = 0;

    for (const org of orgs) {
      // Check if it's time to run for this org
      // Match the hour of the configured time
      const configuredHour = parseInt(org.feeOverdueCheckTime.split(":")[0], 10);
      if (currentHour !== configuredHour) {
        continue;
      }

      log.debug(
        { orgId: org.id, orgName: org.name },
        "Checking overdue fees for organization"
      );

      for (const branch of org.branches) {
        // Find overdue fees that haven't been notified today
        const overdueFees = await prisma.studentFee.findMany({
          where: {
            student: {
              orgId: org.id,
              branchId: branch.id,
              status: "active",
            },
            dueDate: {
              lt: today, // Due date is before today
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

        if (overdueFees.length === 0) {
          continue;
        }

        // Check which fees haven't been notified today
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

        // Filter to only fees that haven't been notified
        const feesToNotify = overdueFees.filter(
          (fee) => !existingFeeIds.has(fee.id)
        );

        if (feesToNotify.length === 0) {
          continue;
        }

        // Create events for overdue fees
        const events = feesToNotify.map((fee) => ({
          type: EVENT_TYPES.FEE_OVERDUE,
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
              daysOverdue: Math.floor(
                (today.getTime() - fee.dueDate.getTime()) / (1000 * 60 * 60 * 24)
              ),
            },
          },
        }));

        const count = await emitEvents(events);
        totalEventsEmitted += count;

        log.debug(
          { orgId: org.id, branchId: branch.id, count },
          "Emitted fee overdue events"
        );
      }
    }

  if (totalEventsEmitted > 0) {
    log.info(
      { totalEvents: totalEventsEmitted },
      "Fee overdue job completed"
    );
  }

  if (totalEventsEmitted === 0) {
    return { skipped: true, metadata: { reason: "No new overdue events to emit" } };
  }

  return {
    eventsEmitted: totalEventsEmitted,
    metadata: { overdueFeesChecked: overdueFeesCount },
  };
}
