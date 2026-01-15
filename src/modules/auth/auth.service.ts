import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import { getPermissionsForRole } from "../../config/permissions.js";
import type { Role } from "../../types/auth.js";
import { createModuleLogger } from "../../config/logger.js";

const log = createModuleLogger("auth-service");

const BCRYPT_ROUNDS = 12;

/**
 * JWT payload structure
 */
export interface JwtPayload {
  userId: string;
  employeeId: string;
  orgId: string;
  branchId: string;
  role: Role;
}

/**
 * Login response structure
 */
export interface LoginResponse {
  token: string;
  user: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    photoUrl: string | null;
    role: Role;
    permissions: string[];
    branchId: string;
    orgId: string;
    mustChangePassword: boolean;
  };
}

/**
 * Generate a random alphanumeric employee ID
 * Format: 6 uppercase alphanumeric characters (e.g., "XK7R2M")
 */
export function generateEmployeeId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing chars: 0, O, 1, I
  const bytes = randomBytes(6);
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token
 */
export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    log.debug({ error }, "Token verification failed");
    return null;
  }
}

/**
 * Authenticate user with employee ID and password
 */
export async function login(
  employeeId: string,
  password: string
): Promise<LoginResponse | null> {
  log.info({ employeeId }, "Login attempt");

  // Find user by employee ID
  const user = await prisma.user.findUnique({
    where: { employeeId },
    select: {
      id: true,
      employeeId: true,
      passwordHash: true,
      mustChangePassword: true,
      firstName: true,
      lastName: true,
      photoUrl: true,
      role: true,
      orgId: true,
      branchId: true,
      isActive: true,
    },
  });

  if (!user) {
    log.warn({ employeeId }, "User not found");
    return null;
  }

  if (!user.isActive) {
    log.warn({ employeeId, userId: user.id }, "Inactive user login attempt");
    return null;
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    log.warn({ employeeId, userId: user.id }, "Invalid password");
    return null;
  }

  // Generate token
  const token = generateToken({
    userId: user.id,
    employeeId: user.employeeId,
    orgId: user.orgId,
    branchId: user.branchId,
    role: user.role as Role,
  });

  // Get permissions for role
  const permissions = getPermissionsForRole(user.role as Role);

  log.info({ employeeId, userId: user.id }, "Login successful");

  return {
    token,
    user: {
      id: user.id,
      employeeId: user.employeeId,
      firstName: user.firstName,
      lastName: user.lastName,
      photoUrl: user.photoUrl,
      role: user.role as Role,
      permissions,
      branchId: user.branchId,
      orgId: user.orgId,
      mustChangePassword: user.mustChangePassword,
    },
  };
}

/**
 * Change user's password
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<boolean> {
  log.info({ userId }, "Password change attempt");

  // Get current user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      passwordHash: true,
    },
  });

  if (!user) {
    log.warn({ userId }, "User not found for password change");
    return false;
  }

  // Verify current password
  const isValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValid) {
    log.warn({ userId }, "Invalid current password");
    return false;
  }

  // Hash new password and update
  const newHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: newHash,
      mustChangePassword: false,
    },
  });

  log.info({ userId }, "Password changed successfully");
  return true;
}

/**
 * Admin: Reset a user's password
 */
export async function resetUserPassword(
  adminUserId: string,
  targetUserId: string,
  newPassword: string,
  adminOrgId: string
): Promise<boolean> {
  log.info({ adminUserId, targetUserId }, "Admin password reset attempt");

  // Verify target user is in the same org
  const targetUser = await prisma.user.findFirst({
    where: {
      id: targetUserId,
      orgId: adminOrgId,
    },
  });

  if (!targetUser) {
    log.warn(
      { adminUserId, targetUserId },
      "Target user not found or not in same org"
    );
    return false;
  }

  // Hash new password and update
  const newHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: targetUserId },
    data: {
      passwordHash: newHash,
      mustChangePassword: true, // Force password change on next login
    },
  });

  log.info({ adminUserId, targetUserId }, "Password reset successful");
  return true;
}

/**
 * Get full user profile
 */
export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      photoUrl: true,
      role: true,
      orgId: true,
      branchId: true,
      createdAt: true,
      updatedAt: true,
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
      branch: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!user) {
    log.warn({ userId }, "User not found");
    return null;
  }

  return {
    id: user.id,
    employeeId: user.employeeId,
    firstName: user.firstName,
    lastName: user.lastName,
    name: `${user.firstName} ${user.lastName}`.trim(),
    phone: user.phone,
    email: user.email,
    photoUrl: user.photoUrl,
    role: user.role as Role,
    permissions: getPermissionsForRole(user.role as Role),
    branchId: user.branchId,
    branchName: user.branch.name,
    organizationId: user.orgId,
    organizationName: user.organization.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Update user profile
 */
export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string | null;
  photoUrl?: string | null;
}

export async function updateUserProfile(
  userId: string,
  input: UpdateProfileInput
) {
  log.info({ userId }, "Profile update attempt");

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      email: input.email,
      photoUrl: input.photoUrl,
    },
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      photoUrl: true,
      role: true,
      orgId: true,
      branchId: true,
      createdAt: true,
      updatedAt: true,
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
      branch: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  log.info({ userId }, "Profile updated successfully");

  return {
    id: user.id,
    employeeId: user.employeeId,
    firstName: user.firstName,
    lastName: user.lastName,
    name: `${user.firstName} ${user.lastName}`.trim(),
    phone: user.phone,
    email: user.email,
    photoUrl: user.photoUrl,
    role: user.role as Role,
    permissions: getPermissionsForRole(user.role as Role),
    branchId: user.branchId,
    branchName: user.branch.name,
    organizationId: user.orgId,
    organizationName: user.organization.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
