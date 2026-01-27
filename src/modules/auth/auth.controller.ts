import type { FastifyRequest, FastifyReply } from "fastify";
import * as authService from "./auth.service.js";
import {
  loginSchema,
  changePasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  type LoginInput,
  type ChangePasswordInput,
  type UpdateProfileInput,
} from "./auth.schema.js";
import { createModuleLogger } from "../../config/logger.js";

const log = createModuleLogger("auth-controller");

function sanitizeBody(body: Record<string, any>) {
  return {
    ...body,
    password: "********",
  };
}

/**
 * Handle login request
 * POST /auth/login
 */
export async function login(
  request: FastifyRequest<{ Body: LoginInput }>,
  reply: FastifyReply,
) {
  log.info({ body: sanitizeBody(request.body) }, "Login request");
  // Validate input
  const parseResult = loginSchema.safeParse(request.body);
  if (!parseResult.success) {
    log.error({ error: parseResult.error }, "Login validation error");
    return reply.code(400).send({
      error: "Validation Error",
      message: parseResult.error.errors[0].message,
    });
  }

  const { employeeId, password } = parseResult.data;

  const result = await authService.login(employeeId, password);

  if (!result) {
    log.error({ employeeId }, "Login failed");
    return reply.code(401).send({
      error: "Unauthorized",
      message: "Invalid employee ID or password",
    });
  }

  log.info({ employeeId }, "Login successful");
  return reply.send(result);
}

/**
 * Handle password change request
 * POST /auth/change-password
 * Requires authentication
 */
export async function changePassword(
  request: FastifyRequest<{ Body: ChangePasswordInput }>,
  reply: FastifyReply,
) {
  log.info({ body: request.body }, "Change password request");
  // Validate input
  const parseResult = changePasswordSchema.safeParse(request.body);
  if (!parseResult.success) {
    log.error({ error: parseResult.error }, "Change password validation error");
    return reply.code(400).send({
      error: "Validation Error",
      message: parseResult.error.errors[0].message,
    });
  }

  const { currentPassword, newPassword } = parseResult.data;
  const userId = request.userContext?.userId;

  if (!userId) {
    log.error({ userId }, "Change password failed");
    return reply.code(401).send({
      error: "Unauthorized",
      message: "Authentication required",
    });
  }

  const success = await authService.changePassword(
    userId,
    currentPassword,
    newPassword,
  );

  if (!success) {
    log.error({ userId }, "Change password failed");
    return reply.code(400).send({
      error: "Bad Request",
      message: "Current password is incorrect",
    });
  }

  log.info({ userId }, "Password changed successfully");
  return reply.send({
    message: "Password changed successfully",
  });
}

/**
 * Handle admin password reset request
 * POST /auth/reset-password
 * Requires admin authentication
 */
export async function resetPassword(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  log.info({ body: request.body }, "Reset password request");
  // Validate input
  const parseResult = resetPasswordSchema.safeParse(request.body);
  if (!parseResult.success) {
    log.error({ error: parseResult.error }, "Reset password validation error");
    return reply.code(400).send({
      error: "Validation Error",
      message: parseResult.error.errors[0].message,
    });
  }

  const { userId: targetUserId, newPassword } = parseResult.data;
  const adminUserId = request.userContext?.userId;
  const adminOrgId = request.userContext?.orgId;

  if (!adminUserId || !adminOrgId) {
    log.error({ adminUserId, adminOrgId }, "Reset password failed");
    return reply.code(401).send({
      error: "Unauthorized",
      message: "Authentication required",
    });
  }

  const success = await authService.resetUserPassword(
    adminUserId,
    targetUserId,
    newPassword,
    adminOrgId,
  );

  if (!success) {
    log.error({ targetUserId }, "Reset password failed");
    return reply.code(404).send({
      error: "Not Found",
      message: "User not found",
    });
  }

  log.info({ targetUserId }, "Reset password successful");
  return reply.send({
    message:
      "Password reset successfully. User will be required to change password on next login.",
  });
}

/**
 * Get current user profile
 * GET /auth/me
 * Requires authentication
 */
export async function getMe(request: FastifyRequest, reply: FastifyReply) {
  log.info({ userContext: request.userContext }, "Get me request");
  const userContext = request.userContext;

  if (!userContext) {
    log.error({ userContext }, "Get me failed");
    return reply.code(401).send({
      error: "Unauthorized",
      message: "Authentication required",
    });
  }

  // Fetch full profile from database
  const profile = await authService.getUserProfile(userContext.userId);

  if (!profile) {
    log.error({ userContext }, "Get me failed");
    return reply.code(404).send({
      error: "Not Found",
      message: "User profile not found",
    });
  }

  log.info({ userContext }, "Get me successful");
  return reply.send(profile);
}

/**
 * Update current user profile
 * PUT /auth/me
 * Requires authentication
 */
export async function updateMe(
  request: FastifyRequest<{ Body: UpdateProfileInput }>,
  reply: FastifyReply,
) {
  log.info({ body: request.body }, "Update me request");
  const userContext = request.userContext;

  if (!userContext) {
    log.error({ userContext }, "Update me failed");
    return reply.code(401).send({
      error: "Unauthorized",
      message: "Authentication required",
    });
  }

  // Validate input
  const parseResult = updateProfileSchema.safeParse(request.body);
  if (!parseResult.success) {
    log.error({ error: parseResult.error }, "Update me validation error");
    return reply.code(400).send({
      error: "Validation Error",
      message: parseResult.error.errors[0].message,
    });
  }

  log.info({ userContext }, "Update me successful");
  const profile = await authService.updateUserProfile(
    userContext.userId,
    parseResult.data,
  );

  log.info({ userContext }, "Update me successful");
  return reply.send({
    data: profile,
    message: "Profile updated successfully",
  });
}
