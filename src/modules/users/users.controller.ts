import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import { parsePaginationParams } from "../../utils/pagination.js";
import { BadRequestError } from "../../utils/error-handler.js";
import * as service from "./users.service.js";
import {
  createUserSchema,
  updateUserSchema,
  userIdParamSchema,
  listUsersQuerySchema,
} from "./users.schema.js";

/**
 * List users with pagination and filters
 */
export async function listUsers(request: ProtectedRequest, reply: FastifyReply) {
  const query = listUsersQuerySchema.safeParse(request.query);
  if (!query.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid query parameters",
      details: query.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const pagination = parsePaginationParams({
    page: String(query.data.page),
    limit: String(query.data.limit),
  });

  const result = await service.getUsers(scope, pagination, {
    role: query.data.role,
    isActive: query.data.isActive,
    search: query.data.search,
  });

  return reply.send(result);
}

/**
 * Get a single user by ID
 */
export async function getUser(request: ProtectedRequest, reply: FastifyReply) {
  const params = userIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid user ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const user = await service.getUserById(params.data.id, scope);

  if (!user) {
    return reply.code(404).send({
      error: "Not Found",
      message: "User not found",
    });
  }

  return reply.send({ data: user });
}

/**
 * Create a new user
 */
export async function createUser(request: ProtectedRequest, reply: FastifyReply) {
  const body = createUserSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const user = await service.createUser(body.data, scope);

  return reply.code(201).send({
    data: user,
    message: `User created successfully. Temporary password: ${user.tempPassword}`,
  });
}

/**
 * Update an existing user
 */
export async function updateUser(request: ProtectedRequest, reply: FastifyReply) {
  const params = userIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid user ID",
      details: params.error.flatten(),
    });
  }

  const body = updateUserSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const user = await service.updateUser(params.data.id, body.data, scope);

  if (!user) {
    return reply.code(404).send({
      error: "Not Found",
      message: "User not found",
    });
  }

  return reply.send({ data: user });
}

/**
 * Deactivate a user (soft delete)
 */
export async function deleteUser(request: ProtectedRequest, reply: FastifyReply) {
  const params = userIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid user ID",
      details: params.error.flatten(),
    });
  }

  // Prevent self-deactivation
  if (params.data.id === request.userContext.userId) {
    throw new BadRequestError("You cannot deactivate your own account");
  }

  const scope = getTenantScopeFromRequest(request);
  const user = await service.deactivateUser(params.data.id, scope);

  if (!user) {
    return reply.code(404).send({
      error: "Not Found",
      message: "User not found",
    });
  }

  return reply.send({
    data: user,
    message: "User deactivated successfully",
  });
}

/**
 * Reset user password to default
 */
export async function resetPassword(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = userIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid user ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const result = await service.resetUserPassword(params.data.id, scope);

  if (!result) {
    return reply.code(404).send({
      error: "Not Found",
      message: "User not found",
    });
  }

  return reply.send({
    message: `Password reset successfully. Temporary password: ${result.tempPassword}`,
  });
}
