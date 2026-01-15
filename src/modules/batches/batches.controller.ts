import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import { parsePaginationParams } from "../../utils/pagination.js";
import {
  createBatchSchema,
  updateBatchSchema,
  batchIdParamSchema,
  listBatchesQuerySchema,
} from "./batches.schema.js";
import * as batchesService from "./batches.service.js";

/**
 * GET /batches
 * List batches with pagination and filters
 */
export async function listBatches(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  // Parse and validate query params
  const query = listBatchesQuerySchema.safeParse(request.query);
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
  const filters = {
    isActive: query.data.isActive,
    teacherId: query.data.teacherId,
    academicLevel: query.data.academicLevel,
  };

  const result = await batchesService.getBatches(scope, pagination, filters);

  return reply.code(200).send(result);
}

/**
 * GET /batches/:id
 * Get a single batch by ID
 */
export async function getBatch(request: ProtectedRequest, reply: FastifyReply) {
  const params = batchIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid batch ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const batch = await batchesService.getBatchById(params.data.id, scope);

  if (!batch) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Batch not found",
    });
  }

  return reply.code(200).send({
    data: batch,
  });
}

/**
 * POST /batches
 * Create a new batch
 */
export async function createBatch(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const body = createBatchSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const batch = await batchesService.createBatch(body.data, scope);

  return reply.code(201).send({
    data: batch,
    message: "Batch created successfully",
  });
}

/**
 * PUT /batches/:id
 * Update an existing batch
 */
export async function updateBatch(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = batchIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid batch ID",
      details: params.error.flatten(),
    });
  }

  const body = updateBatchSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const batch = await batchesService.updateBatch(
    params.data.id,
    body.data,
    scope
  );

  if (!batch) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Batch not found",
    });
  }

  return reply.code(200).send({
    data: batch,
    message: "Batch updated successfully",
  });
}
