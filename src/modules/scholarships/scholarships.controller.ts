import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import { parsePaginationParams } from "../../utils/pagination.js";
import {
  createScholarshipSchema,
  updateScholarshipSchema,
  scholarshipIdParamSchema,
  assignScholarshipSchema,
  studentScholarshipIdParamSchema,
  studentIdParamSchema,
  listScholarshipsQuerySchema,
} from "./scholarships.schema.js";
import * as scholarshipsService from "./scholarships.service.js";

/**
 * GET /scholarships
 * List scholarships with pagination
 */
export async function listScholarships(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const query = listScholarshipsQuerySchema.safeParse(request.query);
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
    type: query.data.type,
    basis: query.data.basis,
  };

  const result = await scholarshipsService.getScholarships(scope, pagination, filters);

  return reply.code(200).send(result);
}

/**
 * GET /scholarships/all
 * Get all active scholarships (for dropdowns)
 */
export async function getAllScholarships(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const scholarships = await scholarshipsService.getAllScholarships(scope);

  return reply.code(200).send({
    data: scholarships,
  });
}

/**
 * GET /scholarships/:id
 * Get a single scholarship
 */
export async function getScholarship(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = scholarshipIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid scholarship ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const scholarship = await scholarshipsService.getScholarshipById(params.data.id, scope);

  return reply.code(200).send({
    data: scholarship,
  });
}

/**
 * POST /scholarships
 * Create a new scholarship
 */
export async function createScholarship(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const body = createScholarshipSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const scholarship = await scholarshipsService.createScholarship(body.data, scope);

  return reply.code(201).send({
    data: scholarship,
    message: "Scholarship created successfully",
  });
}

/**
 * PATCH /scholarships/:id
 * Update a scholarship
 */
export async function updateScholarship(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = scholarshipIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid scholarship ID",
      details: params.error.flatten(),
    });
  }

  const body = updateScholarshipSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const scholarship = await scholarshipsService.updateScholarship(
    params.data.id,
    body.data,
    scope
  );

  return reply.code(200).send({
    data: scholarship,
    message: "Scholarship updated successfully",
  });
}

/**
 * DELETE /scholarships/:id
 * Deactivate a scholarship
 */
export async function deleteScholarship(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = scholarshipIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid scholarship ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  await scholarshipsService.deactivateScholarship(params.data.id, scope);

  return reply.code(200).send({
    message: "Scholarship deactivated successfully",
  });
}

/**
 * POST /scholarships/assign
 * Assign scholarship to a student
 */
export async function assignScholarship(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const body = assignScholarshipSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const { userId } = request.userContext;
  const studentScholarship = await scholarshipsService.assignScholarship(
    body.data,
    userId,
    scope
  );

  return reply.code(201).send({
    data: studentScholarship,
    message: "Scholarship assigned successfully",
  });
}

/**
 * DELETE /scholarships/student/:id
 * Remove scholarship from student
 */
export async function removeScholarship(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = studentScholarshipIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid student scholarship ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  await scholarshipsService.removeScholarship(params.data.id, scope);

  return reply.code(200).send({
    message: "Scholarship removed successfully",
  });
}

/**
 * GET /scholarships/student/:studentId
 * Get scholarships assigned to a student
 */
export async function getStudentScholarships(
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

  const sessionId = (request.query as { sessionId?: string }).sessionId;
  const scope = getTenantScopeFromRequest(request);
  const scholarships = await scholarshipsService.getStudentScholarships(
    params.data.studentId,
    sessionId,
    scope
  );

  return reply.code(200).send({
    data: scholarships,
  });
}
