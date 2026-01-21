import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import {
  updateStudentHealthSchema,
  createHealthCheckupSchema,
  studentIdParamSchema,
  checkupIdParamSchema,
} from "./health.schema.js";
import * as healthService from "./health.service.js";

/**
 * GET /students/:id/health
 * Get student health data
 */
export async function getStudentHealth(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = studentIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid student ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const result = await healthService.getStudentHealth(params.data.id, scope);

  return reply.code(200).send({
    data: result,
  });
}

/**
 * PUT /students/:id/health
 * Update student health data
 */
export async function updateStudentHealth(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = studentIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid student ID",
      details: params.error.flatten(),
    });
  }

  const body = updateStudentHealthSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const health = await healthService.updateStudentHealth(params.data.id, body.data, scope);

  return reply.code(200).send({
    data: health,
    message: "Health data updated successfully",
  });
}

/**
 * GET /students/:id/checkups
 * Get health checkup history
 */
export async function getHealthCheckups(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = studentIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid student ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const result = await healthService.getHealthCheckups(params.data.id, scope);

  return reply.code(200).send({
    data: result,
  });
}

/**
 * POST /students/:id/checkups
 * Create health checkup
 */
export async function createHealthCheckup(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = studentIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid student ID",
      details: params.error.flatten(),
    });
  }

  const body = createHealthCheckupSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const checkup = await healthService.createHealthCheckup(params.data.id, body.data, scope);

  return reply.code(201).send({
    data: checkup,
    message: "Health checkup recorded successfully",
  });
}

/**
 * GET /students/:id/checkups/:checkupId
 * Get specific health checkup
 */
export async function getHealthCheckup(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = studentIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid student ID",
      details: params.error.flatten(),
    });
  }

  const checkupParams = checkupIdParamSchema.safeParse(request.params);
  if (!checkupParams.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid checkup ID",
      details: checkupParams.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const checkup = await healthService.getHealthCheckupById(
    params.data.id,
    checkupParams.data.checkupId,
    scope
  );

  return reply.code(200).send({
    data: checkup,
  });
}

/**
 * DELETE /students/:id/checkups/:checkupId
 * Delete health checkup
 */
export async function deleteHealthCheckup(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = studentIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid student ID",
      details: params.error.flatten(),
    });
  }

  const checkupParams = checkupIdParamSchema.safeParse(request.params);
  if (!checkupParams.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid checkup ID",
      details: checkupParams.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  await healthService.deleteHealthCheckup(params.data.id, checkupParams.data.checkupId, scope);

  return reply.code(200).send({
    message: "Health checkup deleted successfully",
  });
}
