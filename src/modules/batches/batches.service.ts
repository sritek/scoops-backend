import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import { NotFoundError } from "../../utils/error-handler.js";
import {
  type PaginationParams,
  createPaginatedResponse,
  calculateSkip,
} from "../../utils/pagination.js";
import type {
  CreateBatchInput,
  UpdateBatchInput,
  BatchFilters,
} from "./batches.schema.js";

/**
 * Helper to format full name
 */
function formatFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/**
 * Get batches for a branch with pagination
 */
export async function getBatches(
  scope: TenantScope,
  pagination: PaginationParams,
  filters?: BatchFilters
) {
  // Build where clause with tenant scope and filters
  const where: Prisma.BatchWhereInput = {
    orgId: scope.orgId,
    branchId: scope.branchId,
  };

  // Add isActive filter
  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  // Add teacher filter
  if (filters?.teacherId) {
    where.teacherId = filters.teacherId;
  }

  // Add academic level filter
  if (filters?.academicLevel) {
    where.academicLevel = filters.academicLevel;
  }

  const [batches, total] = await Promise.all([
    prisma.batch.findMany({
      where,
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            students: true,
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
    teacher: batch.teacher
      ? {
          id: batch.teacher.id,
          firstName: batch.teacher.firstName,
          lastName: batch.teacher.lastName,
          fullName: formatFullName(
            batch.teacher.firstName,
            batch.teacher.lastName
          ),
        }
      : null,
    studentCount: batch._count.students,
    _count: undefined,
  }));

  return createPaginatedResponse(formattedBatches, total, pagination);
}

/**
 * Get a single batch by ID
 */
export async function getBatchById(id: string, scope: TenantScope) {
  const batch = await prisma.batch.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
    include: {
      teacher: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      _count: {
        select: {
          students: true,
        },
      },
    },
  });

  if (!batch) return null;

  return {
    ...batch,
    teacher: batch.teacher
      ? {
          id: batch.teacher.id,
          firstName: batch.teacher.firstName,
          lastName: batch.teacher.lastName,
          fullName: formatFullName(batch.teacher.firstName, batch.teacher.lastName),
        }
      : null,
    studentCount: batch._count.students,
    _count: undefined,
  };
}

/**
 * Create a new batch
 */
export async function createBatch(input: CreateBatchInput, scope: TenantScope) {
  // Validate teacher belongs to same branch if provided
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
      throw new NotFoundError("Teacher not found or not in the same branch");
    }
  }

  const batch = await prisma.batch.create({
    data: {
      name: input.name,
      academicLevel: input.academicLevel,
      stream: input.stream,
      teacherId: input.teacherId,
      isActive: input.isActive ?? true,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
    include: {
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
    ...batch,
    teacher: batch.teacher
      ? {
          id: batch.teacher.id,
          firstName: batch.teacher.firstName,
          lastName: batch.teacher.lastName,
          fullName: formatFullName(batch.teacher.firstName, batch.teacher.lastName),
        }
      : null,
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
  // First verify batch belongs to tenant
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

  // Validate teacher belongs to same branch if provided
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
      throw new NotFoundError("Teacher not found or not in the same branch");
    }
  }

  const batch = await prisma.batch.update({
    where: { id },
    data: {
      name: input.name,
      academicLevel: input.academicLevel,
      stream: input.stream,
      teacherId: input.teacherId,
      isActive: input.isActive,
    },
    include: {
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
    ...batch,
    teacher: batch.teacher
      ? {
          id: batch.teacher.id,
          firstName: batch.teacher.firstName,
          lastName: batch.teacher.lastName,
          fullName: formatFullName(batch.teacher.firstName, batch.teacher.lastName),
        }
      : null,
  };
}
