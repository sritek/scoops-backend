import type { FastifyInstance } from "fastify";
import { branchContextMiddleware } from "../../middleware/branch.middleware.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions.js";
import {
  paginationQueryOpenApi,
  paginationResponseOpenApi,
} from "../../utils/pagination.js";
import * as controller from "./period-templates.controller.js";

/**
 * Period Templates module routes
 * All routes require authentication and branch context
 */
export async function periodTemplatesRoutes(app: FastifyInstance) {
  /**
   * GET /period-templates
   * List period templates with pagination
   * Requires: STUDENT_VIEW
   */
  app.get(
    "/",
    {
      schema: {
        tags: ["Period Templates"],
        summary: "List period templates",
        description: "Returns paginated period templates for the organization",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            ...paginationQueryOpenApi.properties,
            isDefault: {
              type: "string",
              enum: ["true", "false"],
              description: "Filter by default status",
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
    controller.listTemplates
  );

  /**
   * GET /period-templates/all
   * Get all templates (for dropdowns)
   * Requires: STUDENT_VIEW
   */
  app.get(
    "/all",
    {
      schema: {
        tags: ["Period Templates"],
        summary: "Get all period templates",
        description: "Returns all period templates without pagination (for dropdowns)",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_VIEW),
      ],
    },
    controller.getAllTemplates
  );

  /**
   * GET /period-templates/default
   * Get the default template
   * Requires: STUDENT_VIEW
   */
  app.get(
    "/default",
    {
      schema: {
        tags: ["Period Templates"],
        summary: "Get default period template",
        description: "Returns the default period template (creates one if it doesn't exist)",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_VIEW),
      ],
    },
    controller.getDefaultTemplate
  );

  /**
   * GET /period-templates/:id
   * Get a single template by ID
   * Requires: STUDENT_VIEW
   */
  app.get(
    "/:id",
    {
      schema: {
        tags: ["Period Templates"],
        summary: "Get period template by ID",
        description: "Returns a single period template with slots",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", description: "Template ID" },
          },
          required: ["id"],
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_VIEW),
      ],
    },
    controller.getTemplate
  );

  /**
   * POST /period-templates
   * Create a new period template
   * Requires: SETTINGS_MANAGE (admin only)
   */
  app.post(
    "/",
    {
      schema: {
        tags: ["Period Templates"],
        summary: "Create period template",
        description: "Creates a new period template with time slots",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name", "slots"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            isDefault: { type: "boolean", default: false },
            activeDays: {
              type: "array",
              items: { type: "integer", minimum: 1, maximum: 6 },
              minItems: 1,
              default: [1, 2, 3, 4, 5, 6],
              description: "Active days of week (1=Mon to 6=Sat)",
            },
            slots: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["periodNumber", "startTime", "endTime"],
                properties: {
                  periodNumber: { type: "integer", minimum: 0 },
                  startTime: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
                  endTime: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
                  isBreak: { type: "boolean", default: false },
                  breakName: { type: "string", maxLength: 50 },
                },
              },
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.SETTINGS_MANAGE),
      ],
    },
    controller.createTemplate
  );

  /**
   * PUT /period-templates/:id
   * Update a period template
   * Requires: SETTINGS_MANAGE (admin only)
   */
  app.put(
    "/:id",
    {
      schema: {
        tags: ["Period Templates"],
        summary: "Update period template",
        description: "Updates an existing period template",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", description: "Template ID" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            isDefault: { type: "boolean" },
            activeDays: {
              type: "array",
              items: { type: "integer", minimum: 1, maximum: 6 },
              minItems: 1,
              description: "Active days of week (1=Mon to 6=Sat)",
            },
            slots: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["periodNumber", "startTime", "endTime"],
                properties: {
                  periodNumber: { type: "integer", minimum: 0 },
                  startTime: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
                  endTime: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
                  isBreak: { type: "boolean", default: false },
                  breakName: { type: "string", maxLength: 50 },
                },
              },
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.SETTINGS_MANAGE),
      ],
    },
    controller.updateTemplate
  );

  /**
   * DELETE /period-templates/:id
   * Delete a period template
   * Requires: SETTINGS_MANAGE (admin only)
   */
  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Period Templates"],
        summary: "Delete period template",
        description: "Deletes a period template (cannot delete default)",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", description: "Template ID" },
          },
          required: ["id"],
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.SETTINGS_MANAGE),
      ],
    },
    controller.deleteTemplate
  );
}
