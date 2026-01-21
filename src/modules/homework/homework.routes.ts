/**
 * Homework Routes
 *
 * API routes for managing homework (staff only)
 */

import type { FastifyInstance } from "fastify";
import * as homeworkController from "./homework.controller.js";
import {
  branchContextMiddleware,
  setScopeMiddleware,
} from "../../middleware/branch.middleware.js";

export async function homeworkRoutes(app: FastifyInstance) {
  /**
   * GET /homework - List homework
   */
  app.get(
    "/",
    {
      schema: {
        tags: ["Homework"],
        summary: "List homework",
        description: "Get list of homework with filters",
        querystring: {
          type: "object",
          properties: {
            batchId: { type: "string", format: "uuid" },
            subjectId: { type: "string", format: "uuid" },
            status: { type: "string", enum: ["draft", "published", "closed"] },
            page: { type: "number", default: 1 },
            limit: { type: "number", default: 20 },
          },
        },
      },
      preHandler: [branchContextMiddleware, setScopeMiddleware],
    },
    homeworkController.listHomework
  );

  /**
   * GET /homework/stats - Get homework stats
   */
  app.get(
    "/stats",
    {
      schema: {
        tags: ["Homework"],
        summary: "Get homework stats",
        description: "Get homework statistics for dashboard",
      },
      preHandler: [branchContextMiddleware, setScopeMiddleware],
    },
    homeworkController.getHomeworkStats
  );

  /**
   * GET /homework/:id - Get homework details
   */
  app.get(
    "/:id",
    {
      schema: {
        tags: ["Homework"],
        summary: "Get homework details",
        description: "Get details of a specific homework",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
      preHandler: [branchContextMiddleware, setScopeMiddleware],
    },
    homeworkController.getHomework
  );

  /**
   * POST /homework - Create homework
   */
  app.post(
    "/",
    {
      schema: {
        tags: ["Homework"],
        summary: "Create homework",
        description: "Create a new homework assignment",
        body: {
          type: "object",
          required: ["batchId", "title", "description", "dueDate"],
          properties: {
            batchId: { type: "string", format: "uuid" },
            subjectId: { type: "string", format: "uuid", nullable: true },
            title: { type: "string", minLength: 1, maxLength: 200 },
            description: { type: "string", minLength: 1 },
            attachments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  url: { type: "string", format: "uri" },
                },
              },
            },
            dueDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            totalMarks: { type: "number", nullable: true },
          },
        },
      },
      preHandler: [branchContextMiddleware, setScopeMiddleware],
    },
    homeworkController.createHomework
  );

  /**
   * PUT /homework/:id - Update homework
   */
  app.put(
    "/:id",
    {
      schema: {
        tags: ["Homework"],
        summary: "Update homework",
        description: "Update a homework assignment (draft only)",
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
            batchId: { type: "string", format: "uuid" },
            subjectId: { type: "string", format: "uuid", nullable: true },
            title: { type: "string", minLength: 1, maxLength: 200 },
            description: { type: "string", minLength: 1 },
            attachments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  url: { type: "string", format: "uri" },
                },
              },
            },
            dueDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            totalMarks: { type: "number", nullable: true },
          },
        },
      },
      preHandler: [branchContextMiddleware, setScopeMiddleware],
    },
    homeworkController.updateHomework
  );

  /**
   * DELETE /homework/:id - Delete homework
   */
  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Homework"],
        summary: "Delete homework",
        description: "Delete a homework assignment",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
      preHandler: [branchContextMiddleware, setScopeMiddleware],
    },
    homeworkController.deleteHomework
  );

  /**
   * PUT /homework/:id/publish - Publish homework
   */
  app.put(
    "/:id/publish",
    {
      schema: {
        tags: ["Homework"],
        summary: "Publish homework",
        description: "Publish homework to make it visible to students/parents",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
      preHandler: [branchContextMiddleware, setScopeMiddleware],
    },
    homeworkController.publishHomework
  );

  /**
   * PUT /homework/:id/close - Close homework
   */
  app.put(
    "/:id/close",
    {
      schema: {
        tags: ["Homework"],
        summary: "Close homework",
        description: "Close homework to stop accepting submissions",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
      preHandler: [branchContextMiddleware, setScopeMiddleware],
    },
    homeworkController.closeHomework
  );

  /**
   * GET /homework/:id/submissions - Get submissions
   */
  app.get(
    "/:id/submissions",
    {
      schema: {
        tags: ["Homework"],
        summary: "Get submissions",
        description: "Get all submissions for a homework for grading",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
      preHandler: [branchContextMiddleware, setScopeMiddleware],
    },
    homeworkController.getSubmissions
  );

  /**
   * PUT /homework/submissions/:submissionId/grade - Grade submission
   */
  app.put(
    "/submissions/:submissionId/grade",
    {
      schema: {
        tags: ["Homework"],
        summary: "Grade submission",
        description: "Grade a student submission",
        params: {
          type: "object",
          required: ["submissionId"],
          properties: {
            submissionId: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          required: ["marks"],
          properties: {
            marks: { type: "number", minimum: 0 },
            feedback: { type: "string", maxLength: 1000 },
          },
        },
      },
      preHandler: [branchContextMiddleware, setScopeMiddleware],
    },
    homeworkController.gradeSubmission
  );
}
