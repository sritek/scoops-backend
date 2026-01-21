/**
 * Leave Application Routes
 *
 * Staff routes for managing student leave applications
 */

import type { FastifyInstance } from "fastify";
import * as leaveController from "./leave.controller.js";
import { reviewLeaveSchema, leaveQuerySchema } from "./leave.schema.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import {
  validateBody,
  validateQuery,
} from "../../middleware/validation.middleware.js";
import { PERMISSIONS } from "../../config/permissions";

export async function leaveRoutes(app: FastifyInstance) {
  /**
   * GET /leave-applications - List all leave applications
   */
  app.get(
    "/",
    {
      preHandler: [
        requirePermission(PERMISSIONS.ATTENDANCE_VIEW),
        validateQuery(leaveQuerySchema),
      ],
      schema: {
        tags: ["Leave Applications"],
        summary: "List leave applications",
        description: "Get paginated list of student leave applications",
        querystring: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["pending", "approved", "rejected", "cancelled"],
            },
            batchId: { type: "string", format: "uuid" },
            studentId: { type: "string", format: "uuid" },
            startDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            endDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    leaveController.getLeaveApplications
  );

  /**
   * GET /leave-applications/stats - Get leave stats
   */
  app.get(
    "/stats",
    {
      preHandler: [requirePermission(PERMISSIONS.ATTENDANCE_VIEW)],
      schema: {
        tags: ["Leave Applications"],
        summary: "Get leave statistics",
        description: "Get pending count and monthly statistics",
      },
    },
    leaveController.getLeaveStats
  );

  /**
   * GET /leave-applications/:id - Get single leave application
   */
  app.get(
    "/:id",
    {
      preHandler: [requirePermission(PERMISSIONS.ATTENDANCE_VIEW)],
      schema: {
        tags: ["Leave Applications"],
        summary: "Get leave application",
        description: "Get details of a single leave application",
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    leaveController.getLeaveApplication
  );

  /**
   * PATCH /leave-applications/:id - Review leave application
   */
  app.patch(
    "/:id",
    {
      preHandler: [
        requirePermission(PERMISSIONS.ATTENDANCE_MARK),
        validateBody(reviewLeaveSchema),
      ],
      schema: {
        tags: ["Leave Applications"],
        summary: "Review leave application",
        description: "Approve or reject a pending leave application",
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["approved", "rejected"] },
            reviewNote: { type: "string", maxLength: 500 },
          },
          required: ["status"],
        },
      },
    },
    leaveController.reviewLeaveApplication
  );
}
