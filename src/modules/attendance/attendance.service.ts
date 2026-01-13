import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import { BadRequestError } from "../../utils/error-handler.js";
import { emitEvent, emitEvents, EVENT_TYPES } from "../events/index.js";
import { ROLES } from "../../config/permissions.js";
import type { MarkAttendanceInput } from "./attendance.schema.js";

/**
 * Helper to format full name
 */
function formatFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/**
 * Check if user can access a batch (teacher must be assigned)
 */
export async function canAccessBatch(
  batchId: string,
  userId: string,
  role: string,
  scope: TenantScope
): Promise<boolean> {
  const batch = await prisma.batch.findFirst({
    where: {
      id: batchId,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!batch) return false;

  // Admin can access all batches
  if (role === ROLES.ADMIN) return true;

  // Teacher can only access assigned batches
  if (role === ROLES.TEACHER) {
    return batch.teacherId === userId;
  }

  return false;
}

/**
 * Get attendance for a batch on a specific date
 */
export async function getAttendance(
  batchId: string,
  date: string,
  scope: TenantScope
) {
  const attendanceDate = new Date(date);

  // Get the session with records
  const session = await prisma.attendanceSession.findFirst({
    where: {
      batchId,
      attendanceDate,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
    include: {
      records: {
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!session) {
    // Return empty attendance with batch students
    const students = await prisma.student.findMany({
      where: {
        batchId,
        orgId: scope.orgId,
        branchId: scope.branchId,
        status: "active",
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    return {
      session: null,
      date,
      batchId,
      records: students.map((s) => ({
        studentId: s.id,
        studentName: formatFullName(s.firstName, s.lastName),
        status: null,
      })),
    };
  }

  return {
    session: {
      id: session.id,
      createdAt: session.createdAt,
      createdBy: {
        id: session.createdBy.id,
        firstName: session.createdBy.firstName,
        lastName: session.createdBy.lastName,
        fullName: formatFullName(session.createdBy.firstName, session.createdBy.lastName),
      },
    },
    date,
    batchId,
    records: session.records.map((r) => ({
      studentId: r.student.id,
      studentName: formatFullName(r.student.firstName, r.student.lastName),
      status: r.status,
      markedAt: r.markedAt,
    })),
  };
}

/**
 * Mark attendance for a batch
 */
export async function markAttendance(
  input: MarkAttendanceInput,
  userId: string,
  scope: TenantScope
) {
  const attendanceDate = new Date(input.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const inputDate = new Date(input.date);
  inputDate.setHours(0, 0, 0, 0);

  // Same-day edit only rule
  if (inputDate.getTime() !== today.getTime()) {
    throw new BadRequestError("Attendance can only be marked for today");
  }

  // Verify all students belong to the batch and tenant
  const studentIds = input.records.map((r) => r.studentId);
  const students = await prisma.student.findMany({
    where: {
      id: { in: studentIds },
      batchId: input.batchId,
      orgId: scope.orgId,
      branchId: scope.branchId,
      status: "active",
    },
  });

  if (students.length !== studentIds.length) {
    throw new BadRequestError("Some students are not in this batch or do not exist");
  }

  // Use transaction for atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Find or create session
    let session = await tx.attendanceSession.findFirst({
      where: {
        batchId: input.batchId,
        attendanceDate,
        orgId: scope.orgId,
        branchId: scope.branchId,
      },
    });

    if (!session) {
      session = await tx.attendanceSession.create({
        data: {
          batchId: input.batchId,
          attendanceDate,
          createdById: userId,
          orgId: scope.orgId,
          branchId: scope.branchId,
        },
      });
    }

    // Delete existing records for this session (for update case)
    await tx.attendanceRecord.deleteMany({
      where: {
        attendanceSessionId: session.id,
      },
    });

    // Create new records
    const now = new Date();
    await tx.attendanceRecord.createMany({
      data: input.records.map((r) => ({
        attendanceSessionId: session.id,
        studentId: r.studentId,
        status: r.status,
        markedAt: now,
      })),
    });

    return session;
  });

  // Emit events after successful DB commit
  await emitEvent(EVENT_TYPES.ATTENDANCE_MARKED, scope.orgId, scope.branchId, {
    entityType: "attendance_session",
    entityId: result.id,
    data: {
      batchId: input.batchId,
      date: input.date,
      markedBy: userId,
      totalStudents: input.records.length,
      presentCount: input.records.filter((r) => r.status === "present").length,
      absentCount: input.records.filter((r) => r.status === "absent").length,
    },
  });

  // Emit individual events for absent students
  const absentRecords = input.records.filter((r) => r.status === "absent");
  if (absentRecords.length > 0) {
    const absentEvents = absentRecords.map((r) => ({
      type: EVENT_TYPES.STUDENT_ABSENT,
      orgId: scope.orgId,
      branchId: scope.branchId,
      payload: {
        entityType: "student",
        entityId: r.studentId,
        data: {
          batchId: input.batchId,
          date: input.date,
          sessionId: result.id,
        },
      },
    }));
    await emitEvents(absentEvents);
  }

  // Return the updated attendance
  return getAttendance(input.batchId, input.date, scope);
}
