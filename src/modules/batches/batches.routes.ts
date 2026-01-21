import type { FastifyInstance } from "fastify";
import { branchContextMiddleware } from "../../middleware/branch.middleware.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions";
import {
  paginationQueryOpenApi,
  paginationResponseOpenApi,
} from "../../utils/pagination.js";
import * as controller from "./batches.controller.js";

/**
 * Batches module routes
 * All routes require authentication (applied globally) and branch context
 */
export async function batchesRoutes(app: FastifyInstance) {
  /**
   * GET /batches
   * List batches with pagination and filters
   * Requires: STUDENT_VIEW (batches are needed for attendance/student context)
   */
  app.get(
    "/",
    {
      schema: {
        tags: ["Batches"],
        summary: "List batches",
        description:
          "Returns paginated batches in the current branch with teacher info and student count",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            ...paginationQueryOpenApi.properties,
            isActive: {
              type: "string",
              enum: ["true", "false"],
              description: "Filter by active status",
            },
            teacherId: {
              type: "string",
              format: "uuid",
              description: "Filter by class teacher ID",
            },
            academicLevel: {
              type: "string",
              enum: ["primary", "secondary", "senior_secondary", "coaching"],
              description: "Filter by academic level",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "array",
                items: { type: "object", additionalProperties: true },
                description: "Array of batches",
              },
              pagination: paginationResponseOpenApi,
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_VIEW),
      ],
    },
    controller.listBatches
  );

  /**
   * POST /batches/generate-name
   * Generate a batch name based on parameters
   * Requires: STUDENT_EDIT
   */
  app.post(
    "/generate-name",
    {
      schema: {
        tags: ["Batches"],
        summary: "Generate batch name",
        description: "Auto-generates a batch name based on level, stream, and session",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["academicLevel"],
          properties: {
            academicLevel: {
              type: "string",
              enum: ["primary", "secondary", "senior_secondary", "coaching"],
            },
            stream: {
              type: "string",
              enum: ["science", "commerce", "arts"],
            },
            sessionName: { type: "string" },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_EDIT),
      ],
    },
    controller.generateBatchName
  );

  /**
   * GET /batches/:id
   * Get a single batch by ID
   * Requires: STUDENT_VIEW
   */
  app.get(
    "/:id",
    {
      schema: {
        tags: ["Batches"],
        summary: "Get batch by ID",
        description:
          "Returns a single batch with teacher info and student count",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", description: "Batch ID" },
          },
          required: ["id"],
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_VIEW),
      ],
    },
    controller.getBatch
  );

  /**
   * POST /batches
   * Create a new batch
   * Requires: STUDENT_EDIT (only admin)
   */
  app.post(
    "/",
    {
      schema: {
        tags: ["Batches"],
        summary: "Create a new batch",
        description:
          "Creates a new batch/class with optional teacher and session assignment",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name", "academicLevel"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 255 },
            academicLevel: {
              type: "string",
              enum: ["primary", "secondary", "senior_secondary", "coaching"],
            },
            stream: { type: "string", enum: ["science", "commerce", "arts"] },
            classTeacherId: { type: "string", format: "uuid" },
            sessionId: { type: "string", format: "uuid" },
            isActive: { type: "boolean", default: true },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_EDIT),
      ],
    },
    controller.createBatch
  );

  /**
   * PUT /batches/:id
   * Update an existing batch
   * Requires: STUDENT_EDIT (only admin)
   */
  app.put(
    "/:id",
    {
      schema: {
        tags: ["Batches"],
        summary: "Update a batch",
        description: "Updates an existing batch's information",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", description: "Batch ID" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1, maxLength: 255 },
            academicLevel: {
              type: "string",
              enum: ["primary", "secondary", "senior_secondary", "coaching"],
            },
            stream: {
              type: "string",
              enum: ["science", "commerce", "arts"],
              nullable: true,
            },
            classTeacherId: { type: "string", format: "uuid", nullable: true },
            sessionId: { type: "string", format: "uuid", nullable: true },
            isActive: { type: "boolean" },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_EDIT),
      ],
    },
    controller.updateBatch
  );

  // ===========================
  // SCHEDULE ROUTES
  // ===========================

  /**
   * GET /batches/:id/schedule
   * Get the schedule for a batch
   * Requires: STUDENT_VIEW
   */
  app.get(
    "/:id/schedule",
    {
      schema: {
        tags: ["Batches"],
        summary: "Get batch schedule",
        description: "Returns the weekly schedule (periods) for a batch",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", description: "Batch ID" },
          },
          required: ["id"],
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_VIEW),
      ],
    },
    controller.getBatchSchedule
  );

  /**
   * PUT /batches/:id/schedule
   * Set the full schedule for a batch
   * Requires: STUDENT_EDIT
   */
  app.put(
    "/:id/schedule",
    {
      schema: {
        tags: ["Batches"],
        summary: "Set batch schedule",
        description: "Sets the complete weekly schedule for a batch (replaces existing)",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", description: "Batch ID" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          required: ["periods"],
          properties: {
            periods: {
              type: "array",
              items: {
                type: "object",
                required: ["dayOfWeek", "periodNumber", "startTime", "endTime"],
                properties: {
                  dayOfWeek: { type: "integer", minimum: 1, maximum: 6 },
                  periodNumber: { type: "integer", minimum: 1 },
                  startTime: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
                  endTime: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
                  subjectId: { type: "string", format: "uuid" },
                  teacherId: { type: "string", format: "uuid" },
                },
              },
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_EDIT),
      ],
    },
    controller.setBatchSchedule
  );

  /**
   * PATCH /batches/:id/schedule/:day/:period
   * Update a single period in the schedule
   * Requires: STUDENT_EDIT
   */
  app.patch(
    "/:id/schedule/:day/:period",
    {
      schema: {
        tags: ["Batches"],
        summary: "Update a single period",
        description: "Updates the subject and/or teacher for a specific period",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", description: "Batch ID" },
            day: { type: "integer", minimum: 1, maximum: 6, description: "Day of week (1=Mon)" },
            period: { type: "integer", minimum: 1, description: "Period number" },
          },
          required: ["id", "day", "period"],
        },
        body: {
          type: "object",
          properties: {
            subjectId: { type: "string", format: "uuid", nullable: true },
            teacherId: { type: "string", format: "uuid", nullable: true },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_EDIT),
      ],
    },
    controller.updatePeriod
  );

  /**
   * POST /batches/:id/schedule/initialize
   * Initialize schedule from a period template
   * Requires: STUDENT_EDIT
   */
  app.post(
    "/:id/schedule/initialize",
    {
      schema: {
        tags: ["Batches"],
        summary: "Initialize schedule from template",
        description: "Creates a schedule structure from a period template",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", description: "Batch ID" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          required: ["templateId"],
          properties: {
            templateId: { type: "string", format: "uuid" },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_EDIT),
      ],
    },
    controller.initializeSchedule
  );
}
