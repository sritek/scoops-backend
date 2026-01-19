import { prisma } from "../../config/database.js";
import { createModuleLogger } from "../../config/logger.js";
import { emitEvents, EVENT_TYPES } from "../../modules/events/event-emitter.js";
import type { JobResult } from "../job-tracker.js";

const log = createModuleLogger("birthday-job");

/**
 * Birthday Notifications Job
 * 
 * Sends birthday wishes for students with birthdays today.
 * Runs daily at 9 AM.
 * Only emits events once per student per day.
 * 
 * @returns JobResult with processing stats
 */
export async function sendBirthdayNotificationsJob(): Promise<JobResult> {
  // Early exit: Check if there are ANY active students with DOB set
  const studentsWithDobCount = await prisma.student.count({
    where: {
      status: "active",
      dob: {
        not: null,
      },
    },
  });

  if (studentsWithDobCount === 0) {
    log.debug("No students with DOB set, skipping birthday job");
    return { skipped: true, metadata: { reason: "No students with DOB set" } };
  }

    // Get orgs with birthday notifications enabled
    const orgs = await prisma.organization.findMany({
      where: {
        notificationsEnabled: true,
        birthdayNotifications: true,
      },
      select: {
        id: true,
        name: true,
        branches: {
          select: {
            id: true,
          },
        },
      },
    });

  if (orgs.length === 0) {
    log.debug("No organizations with birthday notifications enabled");
    return { skipped: true, metadata: { reason: "No orgs with birthday notifications enabled" } };
  }

    const today = new Date();
    const todayMonth = today.getMonth() + 1; // 1-12
    const todayDay = today.getDate(); // 1-31

    log.debug(
      { studentsWithDobCount, date: `${todayMonth}/${todayDay}` },
      "Checking birthdays"
    );

    let totalEventsEmitted = 0;

    for (const org of orgs) {
      log.debug(
        { orgId: org.id, orgName: org.name },
        "Checking birthdays for organization"
      );

      for (const branch of org.branches) {
        // Find students with birthdays today
        // We compare month and day from the dob field
        const students = await prisma.student.findMany({
          where: {
            orgId: org.id,
            branchId: branch.id,
            status: "active",
            dob: {
              not: null,
            },
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dob: true,
          },
        });

        // Filter students with birthdays today
        const birthdayStudents = students.filter((student) => {
          if (!student.dob) return false;
          const dob = new Date(student.dob);
          return dob.getMonth() + 1 === todayMonth && dob.getDate() === todayDay;
        });

        if (birthdayStudents.length === 0) {
          continue;
        }

        // Check for existing birthday events today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const existingEvents = await prisma.event.findMany({
          where: {
            orgId: org.id,
            branchId: branch.id,
            type: "birthday",
            createdAt: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
          select: {
            payload: true,
          },
        });

        const existingStudentIds = new Set<string>();
        for (const event of existingEvents) {
          try {
            const payload = JSON.parse(event.payload);
            if (payload.entityId) {
              existingStudentIds.add(payload.entityId);
            }
          } catch {
            // Skip malformed payloads
          }
        }

        // Filter to students who haven't been notified today
        const studentsToNotify = birthdayStudents.filter(
          (student) => !existingStudentIds.has(student.id)
        );

        if (studentsToNotify.length === 0) {
          continue;
        }

        // Calculate age for each student
        const events = studentsToNotify.map((student) => {
          const dob = new Date(student.dob!);
          const age = today.getFullYear() - dob.getFullYear();

          return {
            type: EVENT_TYPES.BIRTHDAY,
            orgId: org.id,
            branchId: branch.id,
            payload: {
              entityType: "student",
              entityId: student.id,
              data: {
                studentId: student.id,
                studentName: `${student.firstName} ${student.lastName}`,
                age,
                date: today.toISOString().split("T")[0],
              },
            },
          };
        });

        const count = await emitEvents(events);
        totalEventsEmitted += count;

        log.debug(
          { orgId: org.id, branchId: branch.id, count },
          "Emitted birthday events"
        );
      }
    }

  if (totalEventsEmitted > 0) {
    log.info(
      { totalEvents: totalEventsEmitted },
      "Birthday notifications job completed"
    );
  }

  if (totalEventsEmitted === 0) {
    return { skipped: true, metadata: { reason: "No birthdays today" } };
  }

  return {
    eventsEmitted: totalEventsEmitted,
    metadata: { studentsChecked: studentsWithDobCount },
  };
}
