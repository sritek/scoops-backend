import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import * as dashboardService from "./dashboard.service.js";

/**
 * GET /dashboard
 * Get complete dashboard summary
 */
export async function getDashboard(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const summary = await dashboardService.getDashboardSummary(scope);

  return reply.code(200).send({
    data: summary,
  });
}

/**
 * GET /dashboard/attendance
 * Get today's attendance summary
 */
export async function getAttendanceSummary(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const summary = await dashboardService.getAttendanceSummary(scope);

  return reply.code(200).send({
    data: summary,
  });
}

/**
 * GET /dashboard/fees/pending
 * Get pending fees summary
 */
export async function getPendingFeesSummary(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const summary = await dashboardService.getPendingFeesSummary(scope);

  return reply.code(200).send({
    data: summary,
  });
}

/**
 * GET /dashboard/fees/collected
 * Get fees collected today
 */
export async function getFeesCollectedToday(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const summary = await dashboardService.getFeesCollectedToday(scope);

  return reply.code(200).send({
    data: summary,
  });
}
