import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import { NotFoundError, BadRequestError } from "../../utils/error-handler.js";
import {
  type PaginationParams,
  createPaginatedResponse,
  calculateSkip,
} from "../../utils/pagination.js";
import type {
  CreateBatchInput,
  UpdateBatchInput,
  BatchFilters,
  PeriodInput,
  UpdatePeriodInput,
} from "./batches.schema.js";

/**
 * Helper to format full name
 */
function formatFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/**
 * Format user for response
 */
function formatUser(user: { id: string; firstName: string; lastName: string } | null) {
  if (!user) return null;
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: formatFullName(user.firstName, user.lastName),
  };
}

/**
 * Get batches for a branch with pagination
 */
export async function getBatches(
  scope: TenantScope,
  pagination: PaginationParams,
  filters?: BatchFilters
) {
  const where: Prisma.BatchWhereInput = {
    orgId: scope.orgId,
    branchId: scope.branchId,
  };

  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  if (filters?.teacherId) {
    where.classTeacherId = filters.teacherId;
  }

  if (filters?.academicLevel) {
    where.academicLevel = filters.academicLevel;
  }

  if (filters?.sessionId) {
    where.sessionId = filters.sessionId;
  }

  const [batches, total] = await Promise.all([
    prisma.batch.findMany({
      where,
      include: {
        classTeacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        session: {
          select: {
            id: true,
            name: true,
            isCurrent: true,
          },
        },
        _count: {
          select: {
            students: true,
            periods: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: calculateSkip(pagination),
      take: pagination.limit,
    }),
    prisma.batch.count({ where }),
  ]);

  const formattedBatches = batches.map((batch) => ({
    ...batch,
    teacher: formatUser(batch.classTeacher), // Keep backward compatibility
    classTeacher: formatUser(batch.classTeacher),
    studentCount: batch._count.students,
    periodCount: batch._count.periods,
    _count: undefined,
  }));

  return createPaginatedResponse(formattedBatches, total, pagination);
}

/**
 * Get a single batch by ID with full details
 */
export async function getBatchById(id: string, scope: TenantScope) {
  const batch = await prisma.batch.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
    include: {
      classTeacher: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      session: true,
      _count: {
        select: {
          students: true,
          periods: true,
        },
      },
    },
  });

  if (!batch) return null;

  return {
    ...batch,
    teacher: formatUser(batch.classTeacher),
    classTeacher: formatUser(batch.classTeacher),
    studentCount: batch._count.students,
    periodCount: batch._count.periods,
    _count: undefined,
  };
}

/**
 * Create a new batch
 */
export async function createBatch(input: CreateBatchInput, scope: TenantScope) {
  // Validate class teacher belongs to same branch if provided
  if (input.classTeacherId) {
    const teacher = await prisma.user.findFirst({
      where: {
        id: input.classTeacherId,
        orgId: scope.orgId,
        branchId: scope.branchId,
        role: "teacher",
        isActive: true,
      },
    });

    if (!teacher) {
      throw new NotFoundError("Teacher not found or not in the same branch");
    }
  }

  // Validate session belongs to same org if provided
  if (input.sessionId) {
    const session = await prisma.academicSession.findFirst({
      where: {
        id: input.sessionId,
        orgId: scope.orgId,
      },
    });

    if (!session) {
      throw new NotFoundError("Academic session not found");
    }
  }

  const batch = await prisma.batch.create({
    data: {
      name: input.name,
      academicLevel: input.academicLevel,
      stream: input.stream,
      classTeacherId: input.classTeacherId,
      sessionId: input.sessionId,
      isActive: input.isActive ?? true,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
    include: {
      classTeacher: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      session: true,
    },
  });

  return {
    ...batch,
    teacher: formatUser(batch.classTeacher),
    classTeacher: formatUser(batch.classTeacher),
  };
}

/**
 * Update an existing batch
 */
export async function updateBatch(
  id: string,
  input: UpdateBatchInput,
  scope: TenantScope
) {
  const existing = await prisma.batch.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!existing) {
    return null;
  }

  // Validate class teacher if provided
  if (input.classTeacherId) {
    const teacher = await prisma.user.findFirst({
      where: {
        id: input.classTeacherId,
        orgId: scope.orgId,
        branchId: scope.branchId,
        role: "teacher",
        isActive: true,
      },
    });

    if (!teacher) {
      throw new NotFoundError("Teacher not found or not in the same branch");
    }
  }

  // Do not allow changing academic session for existing batches
  if (
    input.sessionId !== undefined &&
    input.sessionId !== existing.sessionId
  ) {
    throw new BadRequestError("Changing academic session is not allowed");
  }

  const batch = await prisma.batch.update({
    where: { id },
    data: {
      name: input.name,
      academicLevel: input.academicLevel,
      stream: input.stream,
      classTeacherId: input.classTeacherId,
      isActive: input.isActive,
      // sessionId is intentionally omitted so the existing value is preserved
    },
    include: {
      classTeacher: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      session: true,
    },
  });

  return {
    ...batch,
    teacher: formatUser(batch.classTeacher),
    classTeacher: formatUser(batch.classTeacher),
  };
}

// ===========================
// SCHEDULE MANAGEMENT
// ===========================

/**
 * Get the schedule (periods) for a batch
 */
export async function getBatchSchedule(id: string, scope: TenantScope) {
  const batch = await prisma.batch.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!batch) {
    return null;
  }

  const periods = await prisma.period.findMany({
    where: { batchId: id },
    include: {
      subject: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      teacher: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { periodNumber: "asc" }],
  });

  return periods.map((period) => ({
    ...period,
    teacher: formatUser(period.teacher),
  }));
}

/**
 * Set the full schedule for a batch (replaces existing)
 */
export async function setBatchSchedule(
  id: string,
  periods: PeriodInput[],
  scope: TenantScope
) {
  const batch = await prisma.batch.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!batch) {
    return null;
  }

  // Validate all subjects belong to the org
  const subjectIds = periods.filter((p) => p.subjectId).map((p) => p.subjectId!);
  if (subjectIds.length > 0) {
    const subjects = await prisma.subject.findMany({
      where: {
        id: { in: subjectIds },
        orgId: scope.orgId,
      },
    });
    if (subjects.length !== new Set(subjectIds).size) {
      throw new NotFoundError("One or more subjects not found");
    }
  }

  // Validate all teachers belong to the branch
  const teacherIds = periods.filter((p) => p.teacherId).map((p) => p.teacherId!);
  if (teacherIds.length > 0) {
    const teachers = await prisma.user.findMany({
      where: {
        id: { in: teacherIds },
        orgId: scope.orgId,
        branchId: scope.branchId,
        role: "teacher",
        isActive: true,
      },
    });
    if (teachers.length !== new Set(teacherIds).size) {
      throw new NotFoundError("One or more teachers not found");
    }
  }

  // Delete existing schedule and create new one
  await prisma.$transaction(async (tx) => {
    await tx.period.deleteMany({ where: { batchId: id } });

    await tx.period.createMany({
      data: periods.map((period) => ({
        batchId: id,
        dayOfWeek: period.dayOfWeek,
        periodNumber: period.periodNumber,
        startTime: period.startTime,
        endTime: period.endTime,
        subjectId: period.subjectId,
        teacherId: period.teacherId,
      })),
    });
  });

  return getBatchSchedule(id, scope);
}

/**
 * Update a single period in the schedule
 */
export async function updatePeriod(
  batchId: string,
  dayOfWeek: number,
  periodNumber: number,
  input: UpdatePeriodInput,
  scope: TenantScope
) {
  const batch = await prisma.batch.findFirst({
    where: {
      id: batchId,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!batch) {
    return null;
  }

  // Validate subject if provided
  if (input.subjectId) {
    const subject = await prisma.subject.findFirst({
      where: {
        id: input.subjectId,
        orgId: scope.orgId,
      },
    });
    if (!subject) {
      throw new NotFoundError("Subject not found");
    }
  }

  // Validate teacher if provided
  if (input.teacherId) {
    const teacher = await prisma.user.findFirst({
      where: {
        id: input.teacherId,
        orgId: scope.orgId,
        branchId: scope.branchId,
        role: "teacher",
        isActive: true,
      },
    });
    if (!teacher) {
      throw new NotFoundError("Teacher not found");
    }
  }

  const period = await prisma.period.update({
    where: {
      batchId_dayOfWeek_periodNumber: {
        batchId,
        dayOfWeek,
        periodNumber,
      },
    },
    data: {
      subjectId: input.subjectId,
      teacherId: input.teacherId,
    },
    include: {
      subject: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      teacher: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return {
    ...period,
    teacher: formatUser(period.teacher),
  };
}

/**
 * Initialize schedule from a period template
 */
export async function initializeScheduleFromTemplate(
  batchId: string,
  templateId: string,
  scope: TenantScope
) {
  const batch = await prisma.batch.findFirst({
    where: {
      id: batchId,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!batch) {
    return null;
  }

  const template = await prisma.periodTemplate.findFirst({
    where: {
      id: templateId,
      orgId: scope.orgId,
    },
    include: {
      slots: {
        where: { isBreak: false },
        orderBy: { startTime: "asc" },
      },
    },
  });

  if (!template) {
    throw new NotFoundError("Period template not found");
  }

  // Create periods for each day (Mon-Sat)
  const periods: PeriodInput[] = [];
  for (let day = 1; day <= 6; day++) {
    for (const slot of template.slots) {
      periods.push({
        dayOfWeek: day,
        periodNumber: slot.periodNumber,
        startTime: slot.startTime,
        endTime: slot.endTime,
      });
    }
  }

  return setBatchSchedule(batchId, periods, scope);
}

/**
 * Generate a batch name based on level, stream, and session
 */
export async function generateBatchName(
  academicLevel: string,
  stream: string | undefined,
  sessionName: string | undefined,
  scope: TenantScope
): Promise<string> {
  const levelPrefix =
    academicLevel === "coaching" ? "Batch" : "Class";

  // Count existing batches with same level to auto-generate section
  const existingCount = await prisma.batch.count({
    where: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      academicLevel,
      stream: stream || undefined,
    },
  });

  const section = String.fromCharCode(65 + existingCount); // A, B, C...

  let name = `${levelPrefix} ${section}`;
  if (stream) {
    const streamLabels: Record<string, string> = {
      science: "Science",
      commerce: "Commerce",
      arts: "Arts",
    };
    name += ` - ${streamLabels[stream] || stream}`;
  }
  if (sessionName) {
    name += ` (${sessionName})`;
  }

  return name;
}
