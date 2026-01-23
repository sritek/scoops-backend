import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import * as dashboardService from "./dashboard.service.js";

/**
 * GET /dashboard
 * Get complete dashboard with action items, trends, and role-specific data
 * Returns:
 * - Admin/Staff: Full dashboard (attendance, fees, trends, action items, birthdays, staff attendance)
 * - Teacher: Own batch attendance + fees + birthdays
 * - Accounts: Fees only + collection trends
 */
export async function getDashboard(
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

