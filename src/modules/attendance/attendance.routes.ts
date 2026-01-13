import type { FastifyInstance } from "fastify";
import { branchContextMiddleware } from "../../middleware/branch.middleware.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions.js";
import * as controller from "./attendance.controller.js";

/**
 * Attendance module routes
 * All routes require authentication (applied globally) and branch context
 */
export async function attendanceRoutes(app: FastifyInstance) {
  /**
   * GET /attendance?batchId&date
   * Get attendance for a batch on a specific date
   * Requires: ATTENDANCE_MARK (only admin and teachers)
   * Additional: Teachers can only access assigned batches (checked in service)
   */
  app.get(
    "/",
    {
      schema: {
        tags: ["Attendance"],
        summary: "Get attendance for a batch",
        description: "Returns attendance records for a batch on a specific date. Teachers can only access their assigned batches.",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          required: ["batchId", "date"],
          properties: {
            batchId: { type: "string", format: "uuid", description: "Batch ID" },
            date: { type: "string", format: "date", description: "Date in YYYY-MM-DD format" },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.ATTENDANCE_MARK),
      ],
    },
    controller.getAttendance
  );

  /**
   * POST /attendance/mark
   * Mark attendance for a batch
   * Requires: ATTENDANCE_MARK
   * Additional: Teachers can only mark for assigned batches (checked in service)
   * Rule: Same-day edit only
   */
  app.post(
    "/mark",
    {
      schema: {
        tags: ["Attendance"],
        summary: "Mark attendance for a batch",
        description: "Marks attendance for all students in a batch. Can only mark attendance for today. Teachers can only mark for their assigned batches.",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["batchId", "date", "records"],
          properties: {
            batchId: { type: "string", format: "uuid" },
            date: { type: "string", format: "date", description: "Date in YYYY-MM-DD format (must be today)" },
            records: {
              type: "array",
              items: {
                type: "object",
                required: ["studentId", "status"],
                properties: {
                  studentId: { type: "string", format: "uuid" },
                  status: { type: "string", enum: ["present", "absent"] },
                },
              },
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.ATTENDANCE_MARK),
      ],
    },
    controller.markAttendance
  );
}
