/**
 * Complaints Routes
 */

import type { FastifyInstance } from "fastify";
import { branchContextMiddleware } from "../../middleware/branch.middleware.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions";
import * as controller from "./complaints.controller.js";

export async function complaintsRoutes(app: FastifyInstance) {
  app.get(
    "/stats",
    {
      schema: { tags: ["Complaints"], summary: "Get complaint statistics", security: [{ bearerAuth: [] }] },
      preHandler: [branchContextMiddleware, requirePermission(PERMISSIONS.DASHBOARD_VIEW)],
    },
    controller.getStats
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["Complaints"],
        summary: "Create complaint",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["subject", "description", "category"],
          properties: {
            subject: { type: "string" },
            description: { type: "string" },
            category: { type: "string" },
            priority: { type: "string" },
            studentId: { type: "string" },
          },
        },
      },
      preHandler: [branchContextMiddleware, requirePermission(PERMISSIONS.DASHBOARD_VIEW)],
    },
    controller.createComplaint
  );

  app.get(
    "/",
    {
      schema: {
        tags: ["Complaints"],
        summary: "List complaints",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            page: { type: "number" },
            limit: { type: "number" },
            status: { type: "string" },
            priority: { type: "string" },
            category: { type: "string" },
            assignedToId: { type: "string" },
          },
        },
      },
      preHandler: [branchContextMiddleware, requirePermission(PERMISSIONS.DASHBOARD_VIEW)],
    },
    controller.listComplaints
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["Complaints"],
        summary: "Get complaint",
        security: [{ bearerAuth: [] }],
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
      },
      preHandler: [branchContextMiddleware, requirePermission(PERMISSIONS.DASHBOARD_VIEW)],
    },
    controller.getComplaint
  );

  app.put(
    "/:id",
    {
      schema: {
        tags: ["Complaints"],
        summary: "Update complaint",
        security: [{ bearerAuth: [] }],
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
        body: {
          type: "object",
          properties: {
            status: { type: "string" },
            priority: { type: "string" },
            assignedToId: { type: ["string", "null"] },
            resolution: { type: "string" },
          },
        },
      },
      preHandler: [branchContextMiddleware, requirePermission(PERMISSIONS.SETTINGS_MANAGE)],
    },
    controller.updateComplaint
  );

  app.post(
    "/:id/comments",
    {
      schema: {
        tags: ["Complaints"],
        summary: "Add comment",
        security: [{ bearerAuth: [] }],
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
        body: {
          type: "object",
          required: ["content"],
          properties: {
            content: { type: "string" },
            isInternal: { type: "boolean" },
          },
        },
      },
      preHandler: [branchContextMiddleware, requirePermission(PERMISSIONS.DASHBOARD_VIEW)],
    },
    controller.addComment
  );
}
