import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import {
  type PaginationParams,
  createPaginatedResponse,
  calculateSkip,
} from "../../utils/pagination.js";
import type {
  CreateSessionInput,
  UpdateSessionInput,
  SessionFilters,
} from "./sessions.schema.js";

/**
 * Get academic sessions for an organization with pagination
 */
export async function getSessions(
  scope: TenantScope,
  pagination: PaginationParams,
  filters?: SessionFilters
) {
  const where: Prisma.AcademicSessionWhereInput = {
    orgId: scope.orgId,
  };

  if (filters?.isCurrent !== undefined) {
    where.isCurrent = filters.isCurrent;
  }

  const [sessions, total] = await Promise.all([
    prisma.academicSession.findMany({
      where,
      orderBy: { startDate: "desc" },
      skip: calculateSkip(pagination),
      take: pagination.limit,
    }),
    prisma.academicSession.count({ where }),
  ]);

  return createPaginatedResponse(sessions, total, pagination);
}

/**
 * Get a single session by ID
 */
export async function getSessionById(id: string, scope: TenantScope) {
  return prisma.academicSession.findFirst({
    where: {
      id,
      orgId: scope.orgId,
    },
  });
}

/**
 * Get the current academic session
 */
export async function getCurrentSession(scope: TenantScope) {
  return prisma.academicSession.findFirst({
    where: {
      orgId: scope.orgId,
      isCurrent: true,
    },
  });
}

/**
 * Create a new academic session
 */
export async function createSession(input: CreateSessionInput, scope: TenantScope) {
  // If this session is marked as current, unmark all others
  if (input.isCurrent) {
    await prisma.academicSession.updateMany({
      where: { orgId: scope.orgId, isCurrent: true },
      data: { isCurrent: false },
    });
  }

  return prisma.academicSession.create({
    data: {
      name: input.name,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      isCurrent: input.isCurrent ?? false,
      orgId: scope.orgId,
    },
  });
}

/**
 * Update an existing academic session
 */
export async function updateSession(
  id: string,
  input: UpdateSessionInput,
  scope: TenantScope
) {
  // Verify session belongs to tenant
  const existing = await prisma.academicSession.findFirst({
    where: {
      id,
      orgId: scope.orgId,
    },
  });

  if (!existing) {
    return null;
  }

  // If marking as current, unmark all others first
  if (input.isCurrent === true) {
    await prisma.academicSession.updateMany({
      where: { orgId: scope.orgId, isCurrent: true, id: { not: id } },
      data: { isCurrent: false },
    });
  }

  return prisma.academicSession.update({
    where: { id },
    data: {
      name: input.name,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      isCurrent: input.isCurrent,
    },
  });
}

/**
 * Delete an academic session (only if no batches use it)
 */
export async function deleteSession(id: string, scope: TenantScope) {
  const existing = await prisma.academicSession.findFirst({
    where: {
      id,
      orgId: scope.orgId,
    },
    include: {
      _count: { select: { batches: true } },
    },
  });

  if (!existing) {
    return null;
  }

  if (existing._count.batches > 0) {
    throw new Error("Cannot delete session with existing batches");
  }

  return prisma.academicSession.delete({
    where: { id },
  });
}
