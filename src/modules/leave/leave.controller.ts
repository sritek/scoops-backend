/**
 * Leave Application Controller
 *
 * HTTP handlers for leave application endpoints
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import * as leaveService from "./leave.service.js";
import { leaveQuerySchema, reviewLeaveSchema } from "./leave.schema.js";

/**
 * Helper to get tenant scope from request
 */
function getScope(request: FastifyRequest) {
  return {
    orgId: request.userContext.orgId,
    branchId: request.userContext.branchId,
  };
}

/**
 * GET /leave-applications - List all leave applications (staff)
 */
export async function getLeaveApplications(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const scope = getScope(request);
  const query = leaveQuerySchema.parse(request.query);
  const { page = 1, limit = 20, ...filters } = query;

  const result = await leaveService.getLeaveApplications(scope, filters, {
    page,
    limit,
  });

  return reply.code(200).send(result);
}

/**
 * GET /leave-applications/stats - Get leave stats for dashboard
 */
export async function getLeaveStats(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const scope = getScope(request);
  const stats = await leaveService.getLeaveStats(scope);
  return reply.code(200).send(stats);
}

/**
 * GET /leave-applications/:id - Get single leave application
 */
export async function getLeaveApplication(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const scope = getScope(request);
  const { id } = request.params as { id: string };

  const leave = await leaveService.getLeaveApplication(scope, id);
  return reply.code(200).send(leave);
}

/**
 * PATCH /leave-applications/:id - Review (approve/reject) leave application
 */
export async function reviewLeaveApplication(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const scope = getScope(request);
  const { id } = request.params as { id: string };
  const userId = request.userContext.userId;
  const body = reviewLeaveSchema.parse(request.body);

  const result = await leaveService.reviewLeaveApplication(
    scope,
    id,
    userId,
    body
  );

  return reply.code(200).send(result);
}
