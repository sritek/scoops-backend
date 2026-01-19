import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import {
  type PaginationParams,
  createPaginatedResponse,
  calculateSkip,
} from "../../utils/pagination.js";
import type {
  CreateSubjectInput,
  UpdateSubjectInput,
  SubjectFilters,
} from "./subjects.schema.js";

/**
 * Get subjects for an organization with pagination
 */
export async function getSubjects(
  scope: TenantScope,
  pagination: PaginationParams,
  filters?: SubjectFilters
) {
  const where: Prisma.SubjectWhereInput = {
    orgId: scope.orgId,
  };

  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { code: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [subjects, total] = await Promise.all([
    prisma.subject.findMany({
      where,
      orderBy: { name: "asc" },
      skip: calculateSkip(pagination),
      take: pagination.limit,
    }),
    prisma.subject.count({ where }),
  ]);

  return createPaginatedResponse(subjects, total, pagination);
}

/**
 * Get all active subjects (no pagination, for dropdowns)
 */
export async function getAllActiveSubjects(scope: TenantScope) {
  return prisma.subject.findMany({
    where: {
      orgId: scope.orgId,
      isActive: true,
    },
    orderBy: { name: "asc" },
  });
}

/**
 * Get a single subject by ID
 */
export async function getSubjectById(id: string, scope: TenantScope) {
  return prisma.subject.findFirst({
    where: {
      id,
      orgId: scope.orgId,
    },
  });
}

/**
 * Create a new subject
 */
export async function createSubject(input: CreateSubjectInput, scope: TenantScope) {
  // Check if code already exists for this org
  const existing = await prisma.subject.findFirst({
    where: {
      orgId: scope.orgId,
      code: input.code.toUpperCase(),
    },
  });

  if (existing) {
    throw new Error(`Subject with code "${input.code}" already exists`);
  }

  return prisma.subject.create({
    data: {
      name: input.name,
      code: input.code.toUpperCase(),
      isActive: input.isActive ?? true,
      orgId: scope.orgId,
    },
  });
}

/**
 * Update an existing subject
 */
export async function updateSubject(
  id: string,
  input: UpdateSubjectInput,
  scope: TenantScope
) {
  const existing = await prisma.subject.findFirst({
    where: {
      id,
      orgId: scope.orgId,
    },
  });

  if (!existing) {
    return null;
  }

  // If updating code, check for duplicates
  if (input.code && input.code.toUpperCase() !== existing.code) {
    const duplicate = await prisma.subject.findFirst({
      where: {
        orgId: scope.orgId,
        code: input.code.toUpperCase(),
        id: { not: id },
      },
    });

    if (duplicate) {
      throw new Error(`Subject with code "${input.code}" already exists`);
    }
  }

  return prisma.subject.update({
    where: { id },
    data: {
      name: input.name,
      code: input.code?.toUpperCase(),
      isActive: input.isActive,
    },
  });
}

/**
 * Delete a subject (soft delete by setting isActive to false)
 */
export async function deleteSubject(id: string, scope: TenantScope) {
  const existing = await prisma.subject.findFirst({
    where: {
      id,
      orgId: scope.orgId,
    },
  });

  if (!existing) {
    return null;
  }

  // Soft delete - just deactivate
  return prisma.subject.update({
    where: { id },
    data: { isActive: false },
  });
}
