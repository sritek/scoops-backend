import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import { parsePaginationParams } from "../../utils/pagination.js";
import * as service from "./branch.service.js";
import {
  createBranchSchema,
  updateBranchSchema,
  branchIdParamSchema,
  listBranchesQuerySchema,
} from "./branch.schema.js";

/**
 * List branches with pagination
 */
export async function listBranches(request: ProtectedRequest, reply: FastifyReply) {
  const query = listBranchesQuerySchema.safeParse(request.query);
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

  const result = await service.getBranches(scope, pagination, {
    search: query.data.search,
  });

  return reply.send(result);
}

/**
 * Get a single branch by ID
 */
export async function getBranch(request: ProtectedRequest, reply: FastifyReply) {
  const params = branchIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid branch ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const branch = await service.getBranchById(params.data.id, scope);

  if (!branch) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Branch not found",
    });
  }

  return reply.send({ data: branch });
}

/**
 * Create a new branch
 */
export async function createBranch(request: ProtectedRequest, reply: FastifyReply) {
  const body = createBranchSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const branch = await service.createBranch(body.data, scope);

  return reply.code(201).send({
    data: branch,
    message: "Branch created successfully",
  });
}

/**
 * Update an existing branch
 */
export async function updateBranch(request: ProtectedRequest, reply: FastifyReply) {
  const params = branchIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid branch ID",
      details: params.error.flatten(),
    });
  }

  const body = updateBranchSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const branch = await service.updateBranch(params.data.id, body.data, scope);

  if (!branch) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Branch not found",
    });
  }

  return reply.send({
    data: branch,
    message: "Branch updated successfully",
  });
}
