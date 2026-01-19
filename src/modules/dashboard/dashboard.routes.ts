import type { FastifyInstance } from "fastify";
import { branchContextMiddleware } from "../../middleware/branch.middleware.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions.js";
import * as controller from "./dashboard.controller.js";

/**
 * Dashboard module routes
 * All routes require authentication (applied globally), branch context, and DASHBOARD_VIEW permission
 */
export async function dashboardRoutes(app: FastifyInstance) {
  /**
   * GET /dashboard
   * Get complete dashboard summary
   * Requires: DASHBOARD_VIEW
   */
  app.get(
    "/",
    {
      schema: {
        tags: ["Dashboard"],
        summary: "Get dashboard summary",
        description: "Returns complete dashboard with attendance, pending fees, and fees collected today",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.DASHBOARD_VIEW),
      ],
    },
    controller.getDashboard
  );

  /**
   * GET /dashboard/attendance
   * Get today's attendance summary
   * Requires: DASHBOARD_VIEW
   */
  app.get(
    "/attendance",
    {
      schema: {
        tags: ["Dashboard"],
        summary: "Get attendance summary",
        description: "Returns today's attendance summary by batch",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.DASHBOARD_VIEW),
      ],
    },
    controller.getAttendanceSummary
  );

  /**
   * GET /dashboard/fees/pending
   * Get pending fees summary
   * Requires: DASHBOARD_VIEW
   */
  app.get(
    "/fees/pending",
    {
      schema: {
        tags: ["Dashboard"],
        summary: "Get pending fees summary",
        description: "Returns summary of pending and overdue fees",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.DASHBOARD_VIEW),
      ],
    },
    controller.getPendingFeesSummary
  );

  /**
   * GET /dashboard/fees/collected
   * Get fees collected today
   * Requires: DASHBOARD_VIEW
   */
  app.get(
    "/fees/collected",
    {
      schema: {
        tags: ["Dashboard"],
        summary: "Get fees collected today",
        description: "Returns summary of fees collected today by payment mode",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.DASHBOARD_VIEW),
      ],
    },
    controller.getFeesCollectedToday
  );

  /**
   * GET /dashboard/enhanced
   * Get enhanced dashboard with action items and trends
   * Requires: DASHBOARD_VIEW
   */
  app.get(
    "/enhanced",
    {
      schema: {
        tags: ["Dashboard"],
        summary: "Get enhanced dashboard",
        description: "Returns role-specific dashboard with action items, trends, upcoming birthdays, and more",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "object",
                properties: {
                  attendance: { type: "object" },
                  pendingFees: { type: "object" },
                  feesCollected: { type: "object" },
                  actionItems: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string" },
                        priority: { type: "string" },
                        title: { type: "string" },
                        description: { type: "string" },
                        actionUrl: { type: "string" },
                        count: { type: "number" },
                      },
                    },
                  },
                  trends: {
                    type: "object",
                    properties: {
                      attendance: { type: "array" },
                      feeCollection: { type: "array" },
                    },
                  },
                  upcomingBirthdays: { type: "array" },
                  staffAttendance: { type: "object" },
                },
              },
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.DASHBOARD_VIEW),
      ],
    },
    controller.getEnhancedDashboard
  );
}
