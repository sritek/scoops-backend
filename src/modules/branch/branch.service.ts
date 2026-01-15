import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import { BadRequestError } from "../../utils/error-handler.js";
import {
  type PaginationParams,
  createPaginatedResponse,
  calculateSkip,
} from "../../utils/pagination.js";
import type { CreateBranchInput, UpdateBranchInput, BranchFilters } from "./branch.schema.js";

/**
 * Format branch for response with user count
 */
function formatBranchResponse(branch: {
  id: string;
  orgId: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { users: number; students: number };
}) {
  return {
    id: branch.id,
    orgId: branch.orgId,
    name: branch.name,
    address: branch.address,
    city: branch.city,
    state: branch.state,
    pincode: branch.pincode,
    isDefault: branch.isDefault,
    userCount: branch._count?.users ?? 0,
    studentCount: branch._count?.students ?? 0,
    createdAt: branch.createdAt,
    updatedAt: branch.updatedAt,
  };
}

/**
 * Get branches for an organization with pagination
 */
export async function getBranches(
  scope: TenantScope,
  pagination: PaginationParams,
  filters?: BranchFilters
) {
  // Build where clause - all branches in same org
  const where: Prisma.BranchWhereInput = {
    orgId: scope.orgId,
  };

  // Add search filter
  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { city: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [branches, total] = await Promise.all([
    prisma.branch.findMany({
      where,
      include: {
        _count: {
          select: {
            users: true,
            students: true,
          },
        },
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      skip: calculateSkip(pagination),
      take: pagination.limit,
    }),
    prisma.branch.count({ where }),
  ]);

  return createPaginatedResponse(
    branches.map(formatBranchResponse),
    total,
    pagination
  );
}

/**
 * Get a single branch by ID
 */
export async function getBranchById(id: string, scope: TenantScope) {
  const branch = await prisma.branch.findFirst({
    where: {
      id,
      orgId: scope.orgId,
    },
    include: {
      _count: {
        select: {
          users: true,
          students: true,
        },
      },
    },
  });

  if (!branch) return null;

  return formatBranchResponse(branch);
}

/**
 * Create a new branch
 */
export async function createBranch(input: CreateBranchInput, scope: TenantScope) {
  // If this is marked as default, unset other defaults
  if (input.isDefault) {
    await prisma.branch.updateMany({
      where: {
        orgId: scope.orgId,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });
  }

  const branch = await prisma.branch.create({
    data: {
      name: input.name,
      address: input.address,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      isDefault: input.isDefault ?? false,
      orgId: scope.orgId,
    },
    include: {
      _count: {
        select: {
          users: true,
          students: true,
        },
      },
    },
  });

  return formatBranchResponse(branch);
}

/**
 * Update an existing branch
 */
export async function updateBranch(
  id: string,
  input: UpdateBranchInput,
  scope: TenantScope
) {
  // First verify branch belongs to org
  const existing = await prisma.branch.findFirst({
    where: {
      id,
      orgId: scope.orgId,
    },
  });

  if (!existing) {
    return null;
  }

  // If setting as default, unset other defaults
  if (input.isDefault === true && !existing.isDefault) {
    await prisma.branch.updateMany({
      where: {
        orgId: scope.orgId,
        isDefault: true,
        id: { not: id },
      },
      data: {
        isDefault: false,
      },
    });
  }

  // Prevent unsetting default if it's the only default
  if (input.isDefault === false && existing.isDefault) {
    const defaultCount = await prisma.branch.count({
      where: {
        orgId: scope.orgId,
        isDefault: true,
      },
    });

    if (defaultCount <= 1) {
      throw new BadRequestError(
        "Cannot remove default status. At least one branch must be the default."
      );
    }
  }

  const branch = await prisma.branch.update({
    where: { id },
    data: {
      name: input.name,
      address: input.address,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      isDefault: input.isDefault,
    },
    include: {
      _count: {
        select: {
          users: true,
          students: true,
        },
      },
    },
  });

  return formatBranchResponse(branch);
}
