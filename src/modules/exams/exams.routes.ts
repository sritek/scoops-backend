/**
 * Exams Routes
 */

import type { FastifyInstance } from "fastify";
import { branchContextMiddleware } from "../../middleware/branch.middleware.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions.js";
import * as controller from "./exams.controller.js";

/**
 * Exams routes
 */
export async function examsRoutes(app: FastifyInstance) {
  /**
   * POST /exams
   * Create a new exam
   */
  app.post(
    "/",
    {
      schema: {
        tags: ["Exams"],
        summary: "Create exam",
        description: "Create a new exam",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["batchId", "name", "type", "totalMarks", "passingMarks", "examDate"],
          properties: {
            batchId: { type: "string", format: "uuid" },
            subjectId: { type: "string", format: "uuid" },
            name: { type: "string" },
            type: { type: "string", enum: ["unit_test", "mid_term", "final", "practical", "assignment"] },
            totalMarks: { type: "number" },
            passingMarks: { type: "number" },
            examDate: { type: "string" },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.ATTENDANCE_MARK), // Teachers can create exams
      ],
    },
    controller.createExam
  );

  /**
   * GET /exams
   * List exams
   */
  app.get(
    "/",
    {
      schema: {
        tags: ["Exams"],
        summary: "List exams",
        description: "Get all exams",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            page: { type: "number" },
            limit: { type: "number" },
            batchId: { type: "string", format: "uuid" },
            subjectId: { type: "string", format: "uuid" },
            type: { type: "string" },
            isPublished: { type: "string" },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_VIEW),
      ],
    },
    controller.listExams
  );

  /**
   * GET /exams/report-card/:studentId
   * Get student report card
   */
  app.get(
    "/report-card/:studentId",
    {
      schema: {
        tags: ["Exams"],
        summary: "Get student report card",
        description: "Get all exam results for a student",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["studentId"],
          properties: {
            studentId: { type: "string", format: "uuid" },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_VIEW),
      ],
    },
    controller.getStudentReportCard
  );

  /**
   * GET /exams/report-card/:studentId/pdf
   * Download student report card as PDF
   */
  app.get(
    "/report-card/:studentId/pdf",
    {
      schema: {
        tags: ["Exams"],
        summary: "Download report card PDF",
        description: "Download a PDF report card for a student",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["studentId"],
          properties: {
            studentId: { type: "string", format: "uuid" },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_VIEW),
      ],
    },
    controller.downloadReportCardPDF
  );

  /**
   * GET /exams/:id
   * Get exam by ID
   */
  app.get(
    "/:id",
    {
      schema: {
        tags: ["Exams"],
        summary: "Get exam",
        description: "Get exam details with scores",
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
        requirePermission(PERMISSIONS.STUDENT_VIEW),
      ],
    },
    controller.getExam
  );

  /**
   * PUT /exams/:id
   * Update exam
   */
  app.put(
    "/:id",
    {
      schema: {
        tags: ["Exams"],
        summary: "Update exam",
        description: "Update exam details",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            totalMarks: { type: "number" },
            passingMarks: { type: "number" },
            examDate: { type: "string" },
            isPublished: { type: "boolean" },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.ATTENDANCE_MARK),
      ],
    },
    controller.updateExam
  );

  /**
   * DELETE /exams/:id
   * Delete exam
   */
  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Exams"],
        summary: "Delete exam",
        description: "Delete an exam",
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
    controller.deleteExam
  );

  /**
   * GET /exams/:id/students
   * Get students for marks entry
   */
  app.get(
    "/:id/students",
    {
      schema: {
        tags: ["Exams"],
        summary: "Get students for marks",
        description: "Get list of students with their current scores for an exam",
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
        requirePermission(PERMISSIONS.ATTENDANCE_MARK),
      ],
    },
    controller.getStudentsForMarks
  );

  /**
   * POST /exams/:id/scores
   * Save exam scores
   */
  app.post(
    "/:id/scores",
    {
      schema: {
        tags: ["Exams"],
        summary: "Save exam scores",
        description: "Bulk save/update exam scores",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          required: ["scores"],
          properties: {
            scores: {
              type: "array",
              items: {
                type: "object",
                required: ["studentId", "marksObtained"],
                properties: {
                  studentId: { type: "string", format: "uuid" },
                  marksObtained: { type: ["number", "null"] },
                  remarks: { type: "string" },
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
    controller.saveScores
  );
}
