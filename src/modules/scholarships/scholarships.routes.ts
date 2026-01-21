import type { FastifyInstance } from "fastify";
import { branchContextMiddleware } from "../../middleware/branch.middleware.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions";
import {
  paginationQueryOpenApi,
  paginationResponseOpenApi,
} from "../../utils/pagination.js";
import * as controller from "./scholarships.controller.js";

/**
 * Scholarships module routes
 * All routes require authentication (applied globally) and branch context
 */
export async function scholarshipsRoutes(app: FastifyInstance) {
  /**
   * GET /scholarships
   * List scholarships with pagination
   * Requires: FEE_VIEW
   */
  app.get(
    "/",
    {
      schema: {
        tags: ["Scholarships"],
        summary: "List scholarships",
        description: "Returns paginated scholarships for the organization",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            ...paginationQueryOpenApi.properties,
            isActive: {
              type: "string",
              enum: ["true", "false"],
              description: "Filter by active status (defaults to true)",
            },
            type: {
              type: "string",
              enum: ["percentage", "fixed_amount", "component_waiver"],
              description: "Filter by scholarship type",
            },
            basis: {
              type: "string",
              enum: [
                "merit",
                "need_based",
                "sports",
                "sibling",
                "staff_ward",
                "government",
                "custom",
              ],
              description: "Filter by scholarship basis",
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
              },
              pagination: paginationResponseOpenApi,
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_VIEW),
      ],
    },
    controller.listScholarships
  );

  /**
   * GET /scholarships/all
   * Get all active scholarships (for dropdowns)
   * Requires: FEE_VIEW
   */
  app.get(
    "/all",
    {
      schema: {
        tags: ["Scholarships"],
        summary: "Get all scholarships",
        description: "Returns all active scholarships (for dropdown menus)",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "array",
                items: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_VIEW),
      ],
    },
    controller.getAllScholarships
  );

  /**
   * GET /scholarships/:id
   * Get a single scholarship
   * Requires: FEE_VIEW
   */
  app.get(
    "/:id",
    {
      schema: {
        tags: ["Scholarships"],
        summary: "Get scholarship",
        description: "Returns details of a specific scholarship",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_VIEW),
      ],
    },
    controller.getScholarship
  );

  /**
   * POST /scholarships
   * Create a new scholarship
   * Requires: FEE_UPDATE
   */
  app.post(
    "/",
    {
      schema: {
        tags: ["Scholarships"],
        summary: "Create scholarship",
        description: "Creates a new scholarship for the organization",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name", "type", "basis", "value"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 255 },
            type: {
              type: "string",
              enum: ["percentage", "fixed_amount", "component_waiver"],
            },
            basis: {
              type: "string",
              enum: [
                "merit",
                "need_based",
                "sports",
                "sibling",
                "staff_ward",
                "government",
                "custom",
              ],
            },
            value: { type: "number", minimum: 0 },
            componentId: { type: "string", format: "uuid" },
            maxAmount: { type: "number", minimum: 0 },
            description: { type: "string", maxLength: 500 },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_UPDATE),
      ],
    },
    controller.createScholarship
  );

  /**
   * PATCH /scholarships/:id
   * Update a scholarship
   * Requires: FEE_UPDATE
   */
  app.patch(
    "/:id",
    {
      schema: {
        tags: ["Scholarships"],
        summary: "Update scholarship",
        description: "Updates an existing scholarship",
        security: [{ bearerAuth: [] }],
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
            name: { type: "string", minLength: 1, maxLength: 255 },
            value: { type: "number", minimum: 0 },
            maxAmount: { type: "number", minimum: 0, nullable: true },
            description: { type: "string", maxLength: 500, nullable: true },
            isActive: { type: "boolean" },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_UPDATE),
      ],
    },
    controller.updateScholarship
  );

  /**
   * DELETE /scholarships/:id
   * Deactivate a scholarship
   * Requires: FEE_UPDATE
   */
  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Scholarships"],
        summary: "Deactivate scholarship",
        description: "Deactivates a scholarship (soft delete)",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_UPDATE),
      ],
    },
    controller.deleteScholarship
  );

  /**
   * POST /scholarships/assign
   * Assign scholarship to a student
   * Requires: FEE_UPDATE
   */
  app.post(
    "/assign",
    {
      schema: {
        tags: ["Scholarships"],
        summary: "Assign scholarship to student",
        description: "Assigns a scholarship to a student for a specific academic session",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["studentId", "scholarshipId", "sessionId"],
          properties: {
            studentId: { type: "string", format: "uuid" },
            scholarshipId: { type: "string", format: "uuid" },
            sessionId: { type: "string", format: "uuid" },
            remarks: { type: "string", maxLength: 500 },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_UPDATE),
      ],
    },
    controller.assignScholarship
  );

  /**
   * DELETE /scholarships/student/:id
   * Remove scholarship from student
   * Requires: FEE_UPDATE
   */
  app.delete(
    "/student/:id",
    {
      schema: {
        tags: ["Scholarships"],
        summary: "Remove scholarship from student",
        description: "Removes a scholarship assignment from a student",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_UPDATE),
      ],
    },
    controller.removeScholarship
  );

  /**
   * GET /scholarships/student/:studentId
   * Get scholarships assigned to a student
   * Requires: FEE_VIEW
   */
  app.get(
    "/student/:studentId",
    {
      schema: {
        tags: ["Scholarships"],
        summary: "Get student scholarships",
        description: "Returns all scholarships assigned to a student",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            studentId: { type: "string", format: "uuid" },
          },
          required: ["studentId"],
        },
        querystring: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              format: "uuid",
              description: "Filter by academic session",
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_VIEW),
      ],
    },
    controller.getStudentScholarships
  );
}
