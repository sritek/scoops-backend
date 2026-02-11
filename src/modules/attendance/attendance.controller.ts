import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import {
  getAttendanceQuerySchema,
  getAttendanceHistoryQuerySchema,
  markAttendanceSchema,
} from "./attendance.schema.js";
import * as attendanceService from "./attendance.service.js";
import { parsePaginationParams } from "../../utils/pagination.js";

/**
 * GET /attendance?batchId&date
 * Get attendance for a batch on a specific date
 * Teachers can view attendance for ANY batch (read-only)
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

  // Check if user can VIEW this batch (read-only access)
  const canView = await attendanceService.canViewBatch(
    query.data.batchId,
    userId,
    role,
    scope
  );

  if (!canView) {
    return reply.code(403).send({
      error: "Forbidden",
      message: "You do not have access to view this batch",
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
 * Teachers can only mark attendance for their assigned batch
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

  // Check if user can MARK attendance for this batch (write access)
  const canMark = await attendanceService.canMarkBatch(
    body.data.batchId,
    userId,
    role,
    scope
  );

  if (!canMark) {
    return reply.code(403).send({
      error: "Forbidden",
      message: "You can only mark attendance for your assigned batch",
    });
  }

  const attendance = await attendanceService.markAttendance(
    body.data,
    userId,
    role,
    scope
  );

  return reply.code(200).send({
    data: attendance,
    message: "Attendance marked successfully",
  });
}

/**
 * GET /attendance/history
 * Get attendance history with pagination and filters
 * Teachers can view history for ALL batches (read-only)
 */
export async function getAttendanceHistory(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const query = getAttendanceHistoryQuerySchema.safeParse(request.query);
  if (!query.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid query parameters",
      details: query.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const { userId, role } = request.userContext;

  // If filtering by batch, check view access
  if (query.data.batchId) {
    const canView = await attendanceService.canViewBatch(
      query.data.batchId,
      userId,
      role,
      scope
    );

    if (!canView) {
      return reply.code(403).send({
        error: "Forbidden",
        message: "You do not have access to view this batch",
      });
    }
  }

  const pagination = parsePaginationParams({
    page: String(query.data.page),
    limit: String(query.data.limit),
  });

  const history = await attendanceService.getAttendanceHistory(
    {
      batchId: query.data.batchId,
      startDate: query.data.startDate,
      endDate: query.data.endDate,
    },
    pagination,
    scope
  );

  return reply.code(200).send(history);
}

/**
 * GET /attendance/student/:studentId/history
 * Get attendance history for a single student
 */
export async function getStudentAttendanceHistory(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const { studentId } = request.params as { studentId?: string };

  if (!studentId) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Missing studentId parameter",
    });
  }

  const query = request.query as {
    startDate?: string;
    endDate?: string;
    page?: number | string;
    limit?: number | string;
  };

  const pagination = parsePaginationParams({
    page: query.page != null ? String(query.page) : undefined,
    limit: query.limit != null ? String(query.limit) : undefined,
  });

  const scope = getTenantScopeFromRequest(request);

  const data = await attendanceService.getStudentAttendanceHistory(
    scope,
    studentId,
    {
      startDate: query.startDate,
      endDate: query.endDate,
      page: pagination.page,
      limit: pagination.limit,
    }
  );

  return reply.code(200).send({ data });
}
