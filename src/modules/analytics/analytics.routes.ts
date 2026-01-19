/**
 * Analytics Routes
 */

import type { FastifyInstance, FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { branchContextMiddleware, getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions.js";
import * as analyticsService from "./analytics.service.js";

export async function analyticsRoutes(app: FastifyInstance) {
  /**
   * GET /analytics/branches/comparison
   * Get branch comparison metrics (org-level admins only)
   */
  app.get(
    "/branches/comparison",
    {
      schema: {
        tags: ["Analytics"],
        summary: "Get branch comparison",
        description: "Compare metrics across all branches",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [branchContextMiddleware, requirePermission(PERMISSIONS.SETTINGS_MANAGE)],
    },
    async (request: ProtectedRequest, reply: FastifyReply) => {
      const scope = getTenantScopeFromRequest(request);
      const data = await analyticsService.getBranchComparison(scope.orgId);
      return reply.code(200).send({ data });
    }
  );

  /**
   * GET /analytics/branches/:id/performance
   * Get detailed branch performance
   */
  app.get(
    "/branches/:id/performance",
    {
      schema: {
        tags: ["Analytics"],
        summary: "Get branch performance",
        description: "Get detailed metrics for a specific branch",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
      preHandler: [branchContextMiddleware, requirePermission(PERMISSIONS.DASHBOARD_VIEW)],
    },
    async (request: ProtectedRequest, reply: FastifyReply) => {
      const scope = getTenantScopeFromRequest(request);
      const { id } = request.params as { id: string };
      const data = await analyticsService.getBranchPerformance(id, scope);
      return reply.code(200).send({ data });
    }
  );

  /**
   * GET /analytics/organization
   * Get organization-wide statistics
   */
  app.get(
    "/organization",
    {
      schema: {
        tags: ["Analytics"],
        summary: "Get organization stats",
        description: "Get high-level organization statistics",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [branchContextMiddleware, requirePermission(PERMISSIONS.SETTINGS_MANAGE)],
    },
    async (request: ProtectedRequest, reply: FastifyReply) => {
      const scope = getTenantScopeFromRequest(request);
      const data = await analyticsService.getOrgStats(scope.orgId);
      return reply.code(200).send({ data });
    }
  );
}
