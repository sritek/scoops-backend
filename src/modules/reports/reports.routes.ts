/**
 * Reports Routes
 */

import type { FastifyInstance } from "fastify";
import { branchContextMiddleware } from "../../middleware/branch.middleware.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions.js";
import * as controller from "./reports.controller.js";

/**
 * Reports routes
 */
export async function reportsRoutes(app: FastifyInstance) {
  /**
   * GET /reports/types
   * Get available report types
   */
  app.get(
    "/types",
    {
      schema: {
        tags: ["Reports"],
        summary: "Get report types",
        description: "Get list of available report types with their parameters",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    name: { type: "string" },
                    description: { type: "string" },
                    parameters: { type: "array", items: { type: "string" } },
                  },
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
    controller.getReportTypes
  );

  /**
   * POST /reports
   * Request a new report
   */
  app.post(
    "/",
    {
      schema: {
        tags: ["Reports"],
        summary: "Request report",
        description: "Request a new report generation",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["type", "format"],
          properties: {
            type: {
              type: "string",
              enum: [
                "attendance_monthly",
                "attendance_batch",
                "fee_collection",
                "fee_defaulters",
                "student_performance",
                "branch_summary",
              ],
            },
            format: { type: "string", enum: ["pdf", "excel"] },
            parameters: {
              type: "object",
              properties: {
                startDate: { type: "string" },
                endDate: { type: "string" },
                batchId: { type: "string" },
                month: { type: "number" },
                year: { type: "number" },
              },
            },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              data: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  type: { type: "string" },
                  format: { type: "string" },
                  status: { type: "string" },
                },
              },
              message: { type: "string" },
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.DASHBOARD_VIEW),
      ],
    },
    controller.requestReport
  );

  /**
   * GET /reports
   * List reports
   */
  app.get(
    "/",
    {
      schema: {
        tags: ["Reports"],
        summary: "List reports",
        description: "Get all generated reports",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            page: { type: "number" },
            limit: { type: "number" },
            type: {
              type: "string",
              enum: [
                "attendance_monthly",
                "attendance_batch",
                "fee_collection",
                "fee_defaulters",
                "student_performance",
                "branch_summary",
              ],
            },
            status: {
              type: "string",
              enum: ["pending", "generating", "completed", "failed"],
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.DASHBOARD_VIEW),
      ],
    },
    controller.listReports
  );

  /**
   * GET /reports/:id
   * Get report by ID
   */
  app.get(
    "/:id",
    {
      schema: {
        tags: ["Reports"],
        summary: "Get report",
        description: "Get report details by ID",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.DASHBOARD_VIEW),
      ],
    },
    controller.getReport
  );

  /**
   * GET /reports/:id/download
   * Download report file
   */
  app.get(
    "/:id/download",
    {
      schema: {
        tags: ["Reports"],
        summary: "Download report",
        description: "Download generated report file",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.DASHBOARD_VIEW),
      ],
    },
    controller.downloadReport
  );

  /**
   * DELETE /reports/:id
   * Delete a report
   */
  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Reports"],
        summary: "Delete report",
        description: "Delete a generated report",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.SETTINGS_MANAGE),
      ],
    },
    controller.deleteReport
  );
}
