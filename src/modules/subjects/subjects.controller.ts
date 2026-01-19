import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import { parsePaginationParams } from "../../utils/pagination.js";
import {
  createSubjectSchema,
  updateSubjectSchema,
  subjectIdParamSchema,
  listSubjectsQuerySchema,
} from "./subjects.schema.js";
import * as subjectsService from "./subjects.service.js";

/**
 * GET /subjects
 * List subjects with pagination
 */
export async function listSubjects(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const query = listSubjectsQuerySchema.safeParse(request.query);
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
    search: query.data.search,
  };

  const result = await subjectsService.getSubjects(scope, pagination, filters);

  return reply.code(200).send(result);
}

/**
 * GET /subjects/all
 * Get all active subjects (for dropdowns)
 */
export async function getAllSubjects(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const subjects = await subjectsService.getAllActiveSubjects(scope);

  return reply.code(200).send({
    data: subjects,
  });
}

/**
 * GET /subjects/:id
 * Get a single subject by ID
 */
export async function getSubject(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = subjectIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid subject ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const subject = await subjectsService.getSubjectById(params.data.id, scope);

  if (!subject) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Subject not found",
    });
  }

  return reply.code(200).send({
    data: subject,
  });
}

/**
 * POST /subjects
 * Create a new subject
 */
export async function createSubject(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const body = createSubjectSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);

  try {
    const subject = await subjectsService.createSubject(body.data, scope);

    return reply.code(201).send({
      data: subject,
      message: "Subject created successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("already exists")) {
      return reply.code(409).send({
        error: "Conflict",
        message: error.message,
      });
    }
    throw error;
  }
}

/**
 * PUT /subjects/:id
 * Update an existing subject
 */
export async function updateSubject(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = subjectIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid subject ID",
      details: params.error.flatten(),
    });
  }

  const body = updateSubjectSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);

  try {
    const subject = await subjectsService.updateSubject(
      params.data.id,
      body.data,
      scope
    );

    if (!subject) {
      return reply.code(404).send({
        error: "Not Found",
        message: "Subject not found",
      });
    }

    return reply.code(200).send({
      data: subject,
      message: "Subject updated successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("already exists")) {
      return reply.code(409).send({
        error: "Conflict",
        message: error.message,
      });
    }
    throw error;
  }
}

/**
 * DELETE /subjects/:id
 * Deactivate a subject
 */
export async function deleteSubject(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = subjectIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid subject ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const subject = await subjectsService.deleteSubject(params.data.id, scope);

  if (!subject) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Subject not found",
    });
  }

  return reply.code(200).send({
    data: subject,
    message: "Subject deactivated successfully",
  });
}
