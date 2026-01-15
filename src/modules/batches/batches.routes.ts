import type { FastifyInstance } from "fastify";
import { branchContextMiddleware } from "../../middleware/branch.middleware.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions.js";
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
              type: "boolean",
              description: "Filter by active status",
            },
            teacherId: {
              type: "string",
              format: "uuid",
              description: "Filter by teacher ID",
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
          "Creates a new batch/class with optional teacher assignment",
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
            teacherId: { type: "string", format: "uuid" },
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
            teacherId: { type: "string", format: "uuid", nullable: true },
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
}
