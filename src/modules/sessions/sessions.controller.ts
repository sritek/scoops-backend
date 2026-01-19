import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import { parsePaginationParams } from "../../utils/pagination.js";
import {
  createSessionSchema,
  updateSessionSchema,
  sessionIdParamSchema,
  listSessionsQuerySchema,
} from "./sessions.schema.js";
import * as sessionsService from "./sessions.service.js";

/**
 * GET /sessions
 * List academic sessions with pagination
 */
export async function listSessions(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const query = listSessionsQuerySchema.safeParse(request.query);
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
    isCurrent: query.data.isCurrent,
  };

  const result = await sessionsService.getSessions(scope, pagination, filters);

  return reply.code(200).send(result);
}

/**
 * GET /sessions/current
 * Get the current academic session
 */
export async function getCurrentSession(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const session = await sessionsService.getCurrentSession(scope);

  if (!session) {
    return reply.code(404).send({
      error: "Not Found",
      message: "No current academic session found",
    });
  }

  return reply.code(200).send({
    data: session,
  });
}

/**
 * GET /sessions/:id
 * Get a single session by ID
 */
export async function getSession(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = sessionIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid session ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const session = await sessionsService.getSessionById(params.data.id, scope);

  if (!session) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Session not found",
    });
  }

  return reply.code(200).send({
    data: session,
  });
}

/**
 * POST /sessions
 * Create a new academic session
 */
export async function createSession(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const body = createSessionSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const session = await sessionsService.createSession(body.data, scope);

  return reply.code(201).send({
    data: session,
    message: "Academic session created successfully",
  });
}

/**
 * PUT /sessions/:id
 * Update an existing academic session
 */
export async function updateSession(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = sessionIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid session ID",
      details: params.error.flatten(),
    });
  }

  const body = updateSessionSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const session = await sessionsService.updateSession(
    params.data.id,
    body.data,
    scope
  );

  if (!session) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Session not found",
    });
  }

  return reply.code(200).send({
    data: session,
    message: "Academic session updated successfully",
  });
}

/**
 * DELETE /sessions/:id
 * Delete an academic session
 */
export async function deleteSession(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = sessionIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid session ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);

  try {
    const session = await sessionsService.deleteSession(params.data.id, scope);

    if (!session) {
      return reply.code(404).send({
        error: "Not Found",
        message: "Session not found",
      });
    }

    return reply.code(200).send({
      data: session,
      message: "Academic session deleted successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Cannot delete")) {
      return reply.code(400).send({
        error: "Bad Request",
        message: error.message,
      });
    }
    throw error;
  }
}
