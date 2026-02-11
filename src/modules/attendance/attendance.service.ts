import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../utils/error-handler.js";
import { emitEvent, emitEvents, EVENT_TYPES } from "../events/index.js";
import { ROLES } from "../../config/permissions";
import type { MarkAttendanceInput } from "./attendance.schema.js";
import { createPaginatedResponse, calculateSkip, type PaginationParams } from "../../utils/pagination.js";
import type { Prisma } from "@prisma/client";
import { getStudentsOnLeave } from "../leave/leave.service.js";

/**
 * Helper to format full name
 */
function formatFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/**
 * Check if user can VIEW a batch's attendance (read-only access)
 * Teachers can view ALL batches in their branch
 */
export async function canViewBatch(
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

  // Admin can view all batches
  if (role === ROLES.ADMIN) return true;

  // Teacher can view any batch in their branch (read-only)
  if (role === ROLES.TEACHER) return true;

  return false;
}

/**
 * Check if user can MARK attendance for a batch (write access)
 * Teachers can only mark attendance for their assigned batch
 */
export async function canMarkBatch(
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

  // Admin can mark attendance for all batches
  if (role === ROLES.ADMIN) return true;

  // Teacher can only mark attendance for their assigned batch
  if (role === ROLES.TEACHER) {
    return batch.classTeacherId === userId;
  }

  return false;
}

/**
 * @deprecated Use canViewBatch or canMarkBatch instead
 * Check if user can access a batch (kept for backward compatibility)
 */
export async function canAccessBatch(
  batchId: string,
  userId: string,
  role: string,
  scope: TenantScope
): Promise<boolean> {
  return canViewBatch(batchId, userId, role, scope);
}

/**
 * Get the batch ID where the user is class teacher
 * Returns null if user is not a class teacher of any batch
 */
export async function getTeacherBatchId(
  userId: string,
  scope: TenantScope
): Promise<string | null> {
  const batch = await prisma.batch.findFirst({
    where: {
      classTeacherId: userId,
      orgId: scope.orgId,
      branchId: scope.branchId,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  return batch?.id ?? null;
}

/**
 * Load active students in a batch (single source of truth for "who is in the batch")
 */
async function getActiveBatchStudents(batchId: string, scope: TenantScope) {
  return prisma.student.findMany({
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
}

/**
 * Get attendance for a batch on a specific date
 * When a session exists, returns all active batch students with status from records or null (unmarked).
 */
export async function getAttendance(
  batchId: string,
  date: string,
  scope: TenantScope
) {
  const attendanceDate = new Date(date);

  // Get students on approved leave for this date
  const studentsOnLeave = await getStudentsOnLeave(scope, batchId, date);

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

  const students = await getActiveBatchStudents(batchId, scope);

  if (!session) {
    return {
      session: null,
      date,
      batchId,
      records: students.map((s) => {
        const leaveInfo = studentsOnLeave.get(s.id);
        return {
          studentId: s.id,
          studentName: formatFullName(s.firstName, s.lastName),
          status: null,
          onLeave: !!leaveInfo,
          leaveInfo: leaveInfo ?? null,
        };
      }),
    };
  }

  const recordByStudentId = new Map(
    session.records.map((r) => [r.student.id, { status: r.status, markedAt: r.markedAt }])
  );

  const records = students.map((s) => {
    const leaveInfo = studentsOnLeave.get(s.id);
    const record = recordByStudentId.get(s.id);
    return {
      studentId: s.id,
      studentName: formatFullName(s.firstName, s.lastName),
      status: record?.status ?? null,
      ...(record?.markedAt != null && { markedAt: record.markedAt }),
      onLeave: !!leaveInfo,
      leaveInfo: leaveInfo ?? null,
    };
  });

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
    records,
  };
}

/**
 * Mark attendance for a batch
 * Only admin may edit after attendance is saved; teachers may only mark unmarked students.
 */
export async function markAttendance(
  input: MarkAttendanceInput,
  userId: string,
  role: string,
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

  // Verify all students belong to the batch and tenant (only when sending records)
  if (input.records.length > 0) {
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

    // Load existing records for edit-after-save and teacher scope rules
    const existingRecords = await tx.attendanceRecord.findMany({
      where: { attendanceSessionId: session.id },
      select: { studentId: true },
    });
    const alreadySaved = existingRecords.length > 0;
    const existingByStudentId = new Set(existingRecords.map((r) => r.studentId));

    // Only admin may edit after attendance is saved for this date
    if (alreadySaved && role !== ROLES.ADMIN) {
      throw new ForbiddenError(
        "Attendance for this date has already been saved. Only an admin can change it."
      );
    }

    // Teachers may only add records for students who are not yet marked
    if (role === ROLES.TEACHER) {
      for (const r of input.records) {
        if (existingByStudentId.has(r.studentId)) {
          throw new ForbiddenError(
            "Teachers can only mark students who are not yet marked. Already marked students can be changed only by an admin."
          );
        }
      }
    }

    // Delete existing records for this session (replace-all)
    await tx.attendanceRecord.deleteMany({
      where: {
        attendanceSessionId: session.id,
      },
    });

    // Create new records (skip when payload is empty = all unmarked)
    if (input.records.length > 0) {
      const now = new Date();
      await tx.attendanceRecord.createMany({
        data: input.records.map((r) => ({
          attendanceSessionId: session.id,
          studentId: r.studentId,
          status: r.status,
          markedAt: now,
        })),
      });
    }

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

/**
 * Get attendance history with pagination and filters
 */
export async function getAttendanceHistory(
  filters: {
    batchId?: string;
    startDate?: string;
    endDate?: string;
  },
  pagination: PaginationParams,
  scope: TenantScope
) {
  // Build where clause
  const where: Prisma.AttendanceSessionWhereInput = {
    orgId: scope.orgId,
    branchId: scope.branchId,
  };

  // Filter by batch
  if (filters.batchId) {
    where.batchId = filters.batchId;
  }

  // Filter by date range
  if (filters.startDate || filters.endDate) {
    where.attendanceDate = {};
    if (filters.startDate) {
      where.attendanceDate.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      // Add 1 day to include the end date
      const endDate = new Date(filters.endDate);
      endDate.setDate(endDate.getDate() + 1);
      where.attendanceDate.lt = endDate;
    }
  }

  // Execute query with count
  const [sessions, total] = await Promise.all([
    prisma.attendanceSession.findMany({
      where,
      include: {
        batch: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        records: {
          select: {
            status: true,
          },
        },
      },
      orderBy: { attendanceDate: "desc" },
      skip: calculateSkip(pagination),
      take: pagination.limit,
    }),
    prisma.attendanceSession.count({ where }),
  ]);

  // Format results with stats
  const formattedSessions = sessions.map((session) => {
    const presentCount = session.records.filter((r) => r.status === "present").length;
    const absentCount = session.records.filter((r) => r.status === "absent").length;
    const totalStudents = session.records.length;
    const attendanceRate = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

    return {
      id: session.id,
      date: session.attendanceDate.toISOString().split("T")[0],
      batchId: session.batch.id,
      batchName: session.batch.name,
      createdBy: {
        id: session.createdBy.id,
        name: formatFullName(session.createdBy.firstName, session.createdBy.lastName),
      },
      createdAt: session.createdAt,
      stats: {
        present: presentCount,
        absent: absentCount,
        total: totalStudents,
        attendanceRate,
      },
    };
  });

  return createPaginatedResponse(formattedSessions, total, pagination);
}

/**
 * Get attendance history for a single student
 * Returns paginated records plus a summary over all matching records
 */
export async function getStudentAttendanceHistory(
  scope: TenantScope,
  studentId: string,
  options: {
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  } = {}
) {
  // Verify student belongs to tenant/branch
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!student) {
    throw new NotFoundError("Student not found");
  }

  const page = options.page ?? 1;
  const limit = options.limit ?? 20;
  const skip = calculateSkip({ page, limit });

  const { startDate, endDate } = options;

  const where: Prisma.AttendanceRecordWhereInput = {
    studentId,
    session: {
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  };

  if (startDate || endDate) {
    where.session.attendanceDate = {};
    if (startDate) {
      where.session.attendanceDate.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      where.session.attendanceDate.lt = end;
    }
  }

  const [records, total, presentCount] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      orderBy: {
        session: { attendanceDate: "desc" },
      },
      skip,
      take: limit,
      include: {
        session: {
          select: {
            attendanceDate: true,
            batchId: true,
            batch: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.attendanceRecord.count({ where }),
    prisma.attendanceRecord.count({
      where: { ...where, status: "present" },
    }),
  ]);

  const totalPages = Math.ceil(total / limit);
  const presentDays = presentCount;
  const absentDays = total - presentCount;
  const lateDays = 0; // Late is not currently a separate enum state
  const attendancePercentage =
    total > 0 ? Math.round((presentDays / total) * 100) : null;

  const formattedRecords = records.map((r) => ({
    date: r.session.attendanceDate.toISOString().split("T")[0],
    status: r.status,
    batchId: r.session.batchId,
    batchName: r.session.batch?.name ?? "",
  }));

  return {
    records: formattedRecords,
    summary: {
      totalSessions: total,
      presentDays,
      absentDays,
      lateDays,
      attendancePercentage,
    },
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
