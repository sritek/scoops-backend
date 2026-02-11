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
  CreateFeeComponentInput,
  UpdateFeeComponentInput,
  FeeComponentsFilters,
} from "./fee-components.schema.js";

/**
 * Get fee components for an organization with pagination
 */
export async function getFeeComponents(
  scope: TenantScope,
  pagination: PaginationParams,
  filters?: FeeComponentsFilters
) {
  const where: Prisma.FeeComponentWhereInput = {
    orgId: scope.orgId,
  };

  // Add isActive filter (defaults to true if not specified)
  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive;
  } else {
    where.isActive = true;
  }

  // Add type filter
  if (filters?.type) {
    where.type = filters.type;
  }

  const [components, total] = await Promise.all([
    prisma.feeComponent.findMany({
      where,
      orderBy: [{ type: "asc" }, { name: "asc" }],
      skip: calculateSkip(pagination),
      take: pagination.limit,
    }),
    prisma.feeComponent.count({ where }),
  ]);

  return createPaginatedResponse(components, total, pagination);
}

/**
 * Get all active fee components (no pagination, for dropdowns)
 */
export async function getAllFeeComponents(scope: TenantScope) {
  return prisma.feeComponent.findMany({
    where: {
      orgId: scope.orgId,
      isActive: true,
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}

/**
 * Get a fee component by ID
 */
export async function getFeeComponentById(id: string, scope: TenantScope) {
  const component = await prisma.feeComponent.findFirst({
    where: {
      id,
      orgId: scope.orgId,
    },
  });

  if (!component) {
    throw new NotFoundError("Fee component");
  }

  return component;
}

/**
 * Create a new fee component
 */
export async function createFeeComponent(
  input: CreateFeeComponentInput,
  scope: TenantScope
) {
  // Check for duplicate (same org, type, and name)
  const existing = await prisma.feeComponent.findFirst({
    where: {
      orgId: scope.orgId,
      type: input.type,
      name: input.name,
    },
  });

  if (existing) {
    throw new BadRequestError(
      `A fee component with name "${input.name}" and type "${input.type}" already exists`
    );
  }

  return prisma.feeComponent.create({
    data: {
      orgId: scope.orgId,
      name: input.name,
      type: input.type,
      description: input.description,
    },
  });
}

/**
 * Update a fee component
 */
export async function updateFeeComponent(
  id: string,
  input: UpdateFeeComponentInput,
  scope: TenantScope
) {
  // Verify component belongs to org
  const existing = await prisma.feeComponent.findFirst({
    where: {
      id,
      orgId: scope.orgId,
    },
  });

  if (!existing) {
    throw new NotFoundError("Fee component");
  }

  // If updating name, check for duplicates
  if (input.name && input.name !== existing.name) {
    const duplicate = await prisma.feeComponent.findFirst({
      where: {
        orgId: scope.orgId,
        type: existing.type,
        name: input.name,
        id: { not: id },
      },
    });

    if (duplicate) {
      throw new BadRequestError(
        `A fee component with name "${input.name}" and type "${existing.type}" already exists`
      );
    }
  }

  return prisma.feeComponent.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      isActive: input.isActive,
    },
  });
}

/**
 * Deactivate a fee component (soft delete)
 */
export async function deactivateFeeComponent(id: string, scope: TenantScope) {
  // Verify component belongs to org
  const existing = await prisma.feeComponent.findFirst({
    where: {
      id,
      orgId: scope.orgId,
    },
  });

  if (!existing) {
    throw new NotFoundError("Fee component");
  }

  return prisma.feeComponent.update({
    where: { id },
    data: { isActive: false },
  });
}
