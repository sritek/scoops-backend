import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import {
  createBatchSchema,
  updateBatchSchema,
  batchIdParamSchema,
} from "./batches.schema.js";
import * as batchesService from "./batches.service.js";

/**
 * GET /batches
 * List all batches in the branch
 */
export async function listBatches(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const batches = await batchesService.getBatches(scope);

  return reply.code(200).send({
    data: batches,
    count: batches.length,
  });
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
