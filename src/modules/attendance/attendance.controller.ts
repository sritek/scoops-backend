import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import {
  getAttendanceQuerySchema,
  markAttendanceSchema,
} from "./attendance.schema.js";
import * as attendanceService from "./attendance.service.js";

/**
 * GET /attendance?batchId&date
 * Get attendance for a batch on a specific date
 */
export async function getAttendance(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const query = getAttendanceQuerySchema.safeParse(request.query);
  if (!query.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid query parameters",
      details: query.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const { userId, role } = request.userContext;

  // Check if user can access this batch
  const canAccess = await attendanceService.canAccessBatch(
    query.data.batchId,
    userId,
    role,
    scope
  );

  if (!canAccess) {
    return reply.code(403).send({
      error: "Forbidden",
      message: "You do not have access to this batch",
    });
  }

  const attendance = await attendanceService.getAttendance(
    query.data.batchId,
    query.data.date,
    scope
  );

  return reply.code(200).send({
    data: attendance,
  });
}

/**
 * POST /attendance/mark
 * Mark attendance for a batch
 */
export async function markAttendance(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const body = markAttendanceSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const { userId, role } = request.userContext;

  // Check if user can access this batch
  const canAccess = await attendanceService.canAccessBatch(
    body.data.batchId,
    userId,
    role,
    scope
  );

  if (!canAccess) {
    return reply.code(403).send({
      error: "Forbidden",
      message: "You do not have access to this batch",
    });
  }

  const attendance = await attendanceService.markAttendance(
    body.data,
    userId,
    scope
  );

  return reply.code(200).send({
    data: attendance,
    message: "Attendance marked successfully",
  });
}
