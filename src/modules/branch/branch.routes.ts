import type { FastifyInstance } from "fastify";
import { branchContextMiddleware } from "../../middleware/branch.middleware.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions.js";
import {
  paginationQueryOpenApi,
  paginationResponseOpenApi,
} from "../../utils/pagination.js";
import * as controller from "./branch.controller.js";

/**
 * Branch module routes
 * All routes require authentication (applied globally) and SETTINGS_MANAGE permission
 */
export async function branchRoutes(app: FastifyInstance) {
  /**
   * GET /branches
   * List branches with pagination
   * Requires: SETTINGS_MANAGE
   */
  app.get(
    "/",
    {
      schema: {
        tags: ["Branches"],
        summary: "List branches",
        description: "Returns paginated branches in the organization",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            ...paginationQueryOpenApi.properties,
            search: {
              type: "string",
              description: "Search by name or city",
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
                description: "Array of branches",
              },
              pagination: paginationResponseOpenApi,
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.SETTINGS_MANAGE),
      ],
    },
    controller.listBranches
  );

  /**
   * GET /branches/:id
   * Get a single branch by ID
   * Requires: SETTINGS_MANAGE
   */
  app.get(
    "/:id",
    {
      schema: {
        tags: ["Branches"],
        summary: "Get branch by ID",
        description: "Returns a single branch's details",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", description: "Branch ID" },
          },
          required: ["id"],
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.SETTINGS_MANAGE),
      ],
    },
    controller.getBranch
  );

  /**
   * POST /branches
   * Create a new branch
   * Requires: SETTINGS_MANAGE
   */
  app.post(
    "/",
    {
      schema: {
        tags: ["Branches"],
        summary: "Create a new branch",
        description: "Creates a new branch in the organization",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 255 },
            address: { type: "string", maxLength: 500 },
            city: { type: "string", maxLength: 100 },
            state: { type: "string", maxLength: 100 },
            pincode: { type: "string", maxLength: 10 },
            isDefault: { type: "boolean", default: false },
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
        requirePermission(PERMISSIONS.SETTINGS_MANAGE),
      ],
    },
    controller.createBranch
  );

  /**
   * PUT /branches/:id
   * Update an existing branch
   * Requires: SETTINGS_MANAGE
   */
  app.put(
    "/:id",
    {
      schema: {
        tags: ["Branches"],
        summary: "Update a branch",
        description: "Updates an existing branch's information",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", description: "Branch ID" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1, maxLength: 255 },
            address: { type: "string", maxLength: 500, nullable: true },
            city: { type: "string", maxLength: 100, nullable: true },
            state: { type: "string", maxLength: 100, nullable: true },
            pincode: { type: "string", maxLength: 10, nullable: true },
            isDefault: { type: "boolean" },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.SETTINGS_MANAGE),
      ],
    },
    controller.updateBranch
  );
}
