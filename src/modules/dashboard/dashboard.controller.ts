import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import * as dashboardService from "./dashboard.service.js";

/**
 * GET /dashboard
 * Get complete dashboard summary
 * Returns role-specific data:
 * - Admin/Staff: Full dashboard (attendance + fees)
 * - Teacher: Own batch attendance + own batch fees
 * - Accounts: Fees only (no attendance)
 */
export async function getDashboard(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const { userId, role } = request.userContext;
  
  const summary = await dashboardService.getRoleDashboardSummary(
    role,
    userId,
    scope
  );

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

/**
 * GET /dashboard/enhanced
 * Get enhanced dashboard with action items, trends, and more
 * Returns role-specific data with additional insights
 */
export async function getEnhancedDashboard(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const { userId, role } = request.userContext;

  const dashboard = await dashboardService.getEnhancedDashboard(
    role,
    userId,
    scope
  );

  return reply.code(200).send({
    data: dashboard,
  });
}
