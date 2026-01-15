import type { Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import { BadRequestError } from "../../utils/error-handler.js";
import {
  type PaginationParams,
  createPaginatedResponse,
  calculateSkip,
} from "../../utils/pagination.js";
import { generateEmployeeId, hashPassword } from "../auth/auth.service.js";
import type { CreateUserInput, UpdateUserInput, UserFilters } from "./users.schema.js";

/**
 * Default temporary password for new users
 */
const DEFAULT_TEMP_PASSWORD = "Welcome@123";

/**
 * Helper to format full name
 */
function formatFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/**
 * Format user for response (exclude sensitive fields)
 */
function formatUserResponse(user: {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  orgId: string;
  branchId: string;
  createdAt: Date;
  updatedAt: Date;
  branch?: { id: string; name: string } | null;
}) {
  return {
    id: user.id,
    employeeId: user.employeeId,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: formatFullName(user.firstName, user.lastName),
    phone: user.phone,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    orgId: user.orgId,
    branchId: user.branchId,
    branchName: user.branch?.name ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Get users for an organization with pagination and filters
 */
export async function getUsers(
  scope: TenantScope,
  pagination: PaginationParams,
  filters?: UserFilters
) {
  // Build where clause - users in same org (admin can see all branches)
  const where: Prisma.UserWhereInput = {
    orgId: scope.orgId,
    branchId: scope.branchId, // Only users in same branch
  };

  // Add role filter
  if (filters?.role) {
    where.role = filters.role as Role;
  }

  // Add isActive filter
  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  // Add search filter (search by first name, last name, or employee ID)
  if (filters?.search) {
    where.OR = [
      { firstName: { contains: filters.search, mode: "insensitive" } },
      { lastName: { contains: filters.search, mode: "insensitive" } },
      { employeeId: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: calculateSkip(pagination),
      take: pagination.limit,
    }),
    prisma.user.count({ where }),
  ]);

  return createPaginatedResponse(
    users.map(formatUserResponse),
    total,
    pagination
  );
}

/**
 * Get a single user by ID
 */
export async function getUserById(id: string, scope: TenantScope) {
  const user = await prisma.user.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
    include: {
      branch: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!user) return null;

  return formatUserResponse(user);
}

/**
 * Generate a unique employee ID
 */
async function generateUniqueEmployeeId(): Promise<string> {
  let employeeId: string;
  let exists: boolean;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    employeeId = generateEmployeeId();
    const existing = await prisma.user.findUnique({
      where: { employeeId },
    });
    exists = !!existing;
    attempts++;
  } while (exists && attempts < maxAttempts);

  if (exists) {
    throw new Error("Failed to generate unique employee ID");
  }

  return employeeId;
}

/**
 * Create a new user
 */
export async function createUser(input: CreateUserInput, scope: TenantScope) {
  // Check if phone already exists in org
  const existingPhone = await prisma.user.findFirst({
    where: {
      phone: input.phone,
      orgId: scope.orgId,
    },
  });

  if (existingPhone) {
    throw new BadRequestError("A user with this phone number already exists");
  }

  // Check if email already exists in org (if provided)
  if (input.email) {
    const existingEmail = await prisma.user.findFirst({
      where: {
        email: input.email,
        orgId: scope.orgId,
      },
    });

    if (existingEmail) {
      throw new BadRequestError("A user with this email already exists");
    }
  }

  // Generate unique employee ID
  const employeeId = await generateUniqueEmployeeId();

  // Hash the default password
  const passwordHash = await hashPassword(DEFAULT_TEMP_PASSWORD);

  // Use provided branchId or current user's branch
  const branchId = input.branchId || scope.branchId;

  // Verify branch belongs to same org
  const branch = await prisma.branch.findFirst({
    where: {
      id: branchId,
      orgId: scope.orgId,
    },
  });

  if (!branch) {
    throw new BadRequestError("Invalid branch");
  }

  const user = await prisma.user.create({
    data: {
      employeeId,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      email: input.email,
      role: input.role as Role,
      isActive: true,
      mustChangePassword: true,
      orgId: scope.orgId,
      branchId,
    },
    include: {
      branch: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return {
    ...formatUserResponse(user),
    tempPassword: DEFAULT_TEMP_PASSWORD, // Return temp password for admin to share
  };
}

/**
 * Update an existing user
 */
export async function updateUser(
  id: string,
  input: UpdateUserInput,
  scope: TenantScope
) {
  // First verify user belongs to tenant
  const existing = await prisma.user.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!existing) {
    return null;
  }

  // Check phone uniqueness if being updated
  if (input.phone && input.phone !== existing.phone) {
    const existingPhone = await prisma.user.findFirst({
      where: {
        phone: input.phone,
        orgId: scope.orgId,
        id: { not: id },
      },
    });

    if (existingPhone) {
      throw new BadRequestError("A user with this phone number already exists");
    }
  }

  // Check email uniqueness if being updated
  if (input.email && input.email !== existing.email) {
    const existingEmail = await prisma.user.findFirst({
      where: {
        email: input.email,
        orgId: scope.orgId,
        id: { not: id },
      },
    });

    if (existingEmail) {
      throw new BadRequestError("A user with this email already exists");
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      email: input.email,
      role: input.role as Role | undefined,
      isActive: input.isActive,
    },
    include: {
      branch: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return formatUserResponse(user);
}

/**
 * Deactivate a user (soft delete)
 */
export async function deactivateUser(id: string, scope: TenantScope) {
  // First verify user belongs to tenant
  const existing = await prisma.user.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!existing) {
    return null;
  }

  // Prevent self-deactivation
  // Note: This should be checked in controller with current user ID

  const user = await prisma.user.update({
    where: { id },
    data: {
      isActive: false,
    },
    include: {
      branch: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return formatUserResponse(user);
}

/**
 * Reset user password to default
 */
export async function resetUserPassword(id: string, scope: TenantScope) {
  // First verify user belongs to tenant
  const existing = await prisma.user.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!existing) {
    return null;
  }

  const passwordHash = await hashPassword(DEFAULT_TEMP_PASSWORD);

  await prisma.user.update({
    where: { id },
    data: {
      passwordHash,
      mustChangePassword: true,
    },
  });

  return { tempPassword: DEFAULT_TEMP_PASSWORD };
}
