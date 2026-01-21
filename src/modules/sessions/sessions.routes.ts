import type { FastifyInstance } from "fastify";
import { branchContextMiddleware } from "../../middleware/branch.middleware.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions";
import {
  paginationQueryOpenApi,
  paginationResponseOpenApi,
} from "../../utils/pagination.js";
import * as controller from "./sessions.controller.js";

/**
 * Academic Sessions module routes
 * All routes require authentication and branch context
 */
export async function sessionsRoutes(app: FastifyInstance) {
  /**
   * GET /sessions
   * List academic sessions with pagination
   * Requires: STUDENT_VIEW
   */
  app.get(
    "/",
    {
      schema: {
        tags: ["Sessions"],
        summary: "List academic sessions",
        description: "Returns paginated academic sessions for the organization",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            ...paginationQueryOpenApi.properties,
            isCurrent: {
              type: "string",
              enum: ["true", "false"],
              description: "Filter by current session status",
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
    controller.listSessions
  );

  /**
   * GET /sessions/current
   * Get the current academic session
   * Requires: STUDENT_VIEW
   */
  app.get(
    "/current",
    {
      schema: {
        tags: ["Sessions"],
        summary: "Get current academic session",
        description: "Returns the current active academic session",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_VIEW),
      ],
    },
    controller.getCurrentSession
  );

  /**
   * GET /sessions/:id
   * Get a single session by ID
   * Requires: STUDENT_VIEW
   */
  app.get(
    "/:id",
    {
      schema: {
        tags: ["Sessions"],
        summary: "Get session by ID",
        description: "Returns a single academic session",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", description: "Session ID" },
          },
          required: ["id"],
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_VIEW),
      ],
    },
    controller.getSession
  );

  /**
   * POST /sessions
   * Create a new academic session
   * Requires: SETTINGS_MANAGE (admin only)
   */
  app.post(
    "/",
    {
      schema: {
        tags: ["Sessions"],
        summary: "Create academic session",
        description: "Creates a new academic session",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name", "startDate", "endDate"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            startDate: { type: "string", format: "date" },
            endDate: { type: "string", format: "date" },
            isCurrent: { type: "boolean", default: false },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.SETTINGS_MANAGE),
      ],
    },
    controller.createSession
  );

  /**
   * PUT /sessions/:id
   * Update an academic session
   * Requires: SETTINGS_MANAGE (admin only)
   */
  app.put(
    "/:id",
    {
      schema: {
        tags: ["Sessions"],
        summary: "Update academic session",
        description: "Updates an existing academic session",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", description: "Session ID" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            startDate: { type: "string", format: "date" },
            endDate: { type: "string", format: "date" },
            isCurrent: { type: "boolean" },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.SETTINGS_MANAGE),
      ],
    },
    controller.updateSession
  );

  /**
   * DELETE /sessions/:id
   * Delete an academic session
   * Requires: SETTINGS_MANAGE (admin only)
   */
  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Sessions"],
        summary: "Delete academic session",
        description: "Deletes an academic session (only if no batches use it)",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", description: "Session ID" },
          },
          required: ["id"],
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.SETTINGS_MANAGE),
      ],
    },
    controller.deleteSession
  );
}
