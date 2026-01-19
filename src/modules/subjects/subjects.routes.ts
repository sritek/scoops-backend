import type { FastifyInstance } from "fastify";
import { branchContextMiddleware } from "../../middleware/branch.middleware.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions.js";
import {
  paginationQueryOpenApi,
  paginationResponseOpenApi,
} from "../../utils/pagination.js";
import * as controller from "./subjects.controller.js";

/**
 * Subjects module routes
 * All routes require authentication and branch context
 */
export async function subjectsRoutes(app: FastifyInstance) {
  /**
   * GET /subjects
   * List subjects with pagination
   * Requires: STUDENT_VIEW
   */
  app.get(
    "/",
    {
      schema: {
        tags: ["Subjects"],
        summary: "List subjects",
        description: "Returns paginated subjects for the organization",
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
            search: {
              type: "string",
              description: "Search by name or code",
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
        requirePermission(PERMISSIONS.STUDENT_VIEW),
      ],
    },
    controller.listSubjects
  );

  /**
   * GET /subjects/all
   * Get all active subjects (for dropdowns)
   * Requires: STUDENT_VIEW
   */
  app.get(
    "/all",
    {
      schema: {
        tags: ["Subjects"],
        summary: "Get all active subjects",
        description: "Returns all active subjects without pagination (for dropdowns)",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_VIEW),
      ],
    },
    controller.getAllSubjects
  );

  /**
   * GET /subjects/:id
   * Get a single subject by ID
   * Requires: STUDENT_VIEW
   */
  app.get(
    "/:id",
    {
      schema: {
        tags: ["Subjects"],
        summary: "Get subject by ID",
        description: "Returns a single subject",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", description: "Subject ID" },
          },
          required: ["id"],
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_VIEW),
      ],
    },
    controller.getSubject
  );

  /**
   * POST /subjects
   * Create a new subject
   * Requires: SETTINGS_MANAGE (admin only)
   */
  app.post(
    "/",
    {
      schema: {
        tags: ["Subjects"],
        summary: "Create subject",
        description: "Creates a new subject",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name", "code"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            code: { type: "string", minLength: 1, maxLength: 20 },
            isActive: { type: "boolean", default: true },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.SETTINGS_MANAGE),
      ],
    },
    controller.createSubject
  );

  /**
   * PUT /subjects/:id
   * Update a subject
   * Requires: SETTINGS_MANAGE (admin only)
   */
  app.put(
    "/:id",
    {
      schema: {
        tags: ["Subjects"],
        summary: "Update subject",
        description: "Updates an existing subject",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", description: "Subject ID" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            code: { type: "string", minLength: 1, maxLength: 20 },
            isActive: { type: "boolean" },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.SETTINGS_MANAGE),
      ],
    },
    controller.updateSubject
  );

  /**
   * DELETE /subjects/:id
   * Deactivate a subject
   * Requires: SETTINGS_MANAGE (admin only)
   */
  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Subjects"],
        summary: "Deactivate subject",
        description: "Deactivates a subject (soft delete)",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", description: "Subject ID" },
          },
          required: ["id"],
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.SETTINGS_MANAGE),
      ],
    },
    controller.deleteSubject
  );
}
