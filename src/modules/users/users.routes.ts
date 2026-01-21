import type { FastifyInstance } from "fastify";
import { branchContextMiddleware } from "../../middleware/branch.middleware.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions";
import {
  paginationQueryOpenApi,
  paginationResponseOpenApi,
} from "../../utils/pagination.js";
import * as controller from "./users.controller.js";

/**
 * Users module routes
 * All routes require authentication (applied globally) and USER_MANAGE permission
 */
export async function usersRoutes(app: FastifyInstance) {
  /**
   * GET /users
   * List users with pagination and filters
   * Requires: USER_MANAGE
   */
  app.get(
    "/",
    {
      schema: {
        tags: ["Users"],
        summary: "List users",
        description:
          "Returns paginated users in the current branch. Supports filtering by role and search.",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            ...paginationQueryOpenApi.properties,
            role: {
              type: "string",
              enum: ["admin", "teacher", "accounts", "staff"],
              description: "Filter by role",
            },
            isActive: {
              type: "string",
              enum: ["true", "false"],
              description: "Filter by active status",
            },
            search: {
              type: "string",
              description: "Search by name or employee ID",
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
                description: "Array of users",
              },
              pagination: paginationResponseOpenApi,
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.USER_MANAGE),
      ],
    },
    controller.listUsers
  );

  /**
   * GET /users/:id
   * Get a single user by ID
   * Requires: USER_MANAGE
   */
  app.get(
    "/:id",
    {
      schema: {
        tags: ["Users"],
        summary: "Get user by ID",
        description: "Returns a single user's details",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", description: "User ID" },
          },
          required: ["id"],
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.USER_MANAGE),
      ],
    },
    controller.getUser
  );

  /**
   * POST /users
   * Create a new user
   * Requires: USER_MANAGE
   */
  app.post(
    "/",
    {
      schema: {
        tags: ["Users"],
        summary: "Create a new user",
        description:
          "Creates a new user with an auto-generated employee ID and temporary password",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["firstName", "lastName", "phone", "role"],
          properties: {
            firstName: { type: "string", minLength: 1, maxLength: 255 },
            lastName: { type: "string", minLength: 1, maxLength: 255 },
            phone: { type: "string", minLength: 10, maxLength: 15 },
            email: { type: "string", format: "email" },
            role: {
              type: "string",
              enum: ["admin", "teacher", "accounts", "staff"],
            },
            branchId: {
              type: "string",
              format: "uuid",
              description: "Branch ID (defaults to current branch)",
            },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              data: { type: "object" },
              message: { type: "string" },
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.USER_MANAGE),
      ],
    },
    controller.createUser
  );

  /**
   * PUT /users/:id
   * Update an existing user
   * Requires: USER_MANAGE
   */
  app.put(
    "/:id",
    {
      schema: {
        tags: ["Users"],
        summary: "Update a user",
        description: "Updates an existing user's information",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", description: "User ID" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            firstName: { type: "string", minLength: 1, maxLength: 255 },
            lastName: { type: "string", minLength: 1, maxLength: 255 },
            phone: { type: "string", minLength: 10, maxLength: 15 },
            email: { type: "string", format: "email", nullable: true },
            role: {
              type: "string",
              enum: ["admin", "teacher", "accounts", "staff"],
            },
            isActive: { type: "boolean" },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.USER_MANAGE),
      ],
    },
    controller.updateUser
  );

  /**
   * DELETE /users/:id
   * Deactivate a user (soft delete)
   * Requires: USER_MANAGE
   */
  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Users"],
        summary: "Deactivate a user",
        description: "Soft deletes a user by setting isActive to false",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", description: "User ID" },
          },
          required: ["id"],
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.USER_MANAGE),
      ],
    },
    controller.deleteUser
  );

  /**
   * POST /users/:id/reset-password
   * Reset user password to default
   * Requires: USER_MANAGE
   */
  app.post(
    "/:id/reset-password",
    {
      schema: {
        tags: ["Users"],
        summary: "Reset user password",
        description: "Resets user password to default temporary password",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", description: "User ID" },
          },
          required: ["id"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.USER_MANAGE),
      ],
    },
    controller.resetPassword
  );
}
