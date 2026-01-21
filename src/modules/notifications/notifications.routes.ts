import type { FastifyInstance } from "fastify";
import { branchContextMiddleware } from "../../middleware/branch.middleware.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions";
import {
  listNotifications,
  getNotificationStats,
  getNotification,
  retryNotification,
} from "./notifications.controller.js";
import { paginationQueryOpenApi, paginationResponseOpenApi } from "../../utils/pagination.js";

export async function notificationsRoutes(fastify: FastifyInstance) {
  // All routes require branch context and settings permission
  fastify.addHook("preHandler", branchContextMiddleware);

  // GET /notifications - List notifications with pagination
  fastify.get(
    "/",
    {
      preHandler: [requirePermission(PERMISSIONS.SETTINGS_MANAGE)],
      schema: {
        tags: ["Notifications"],
        summary: "List notification logs",
        description: "Get paginated list of notification logs with optional filters",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            ...paginationQueryOpenApi.properties,
            status: {
              type: "string",
              enum: ["pending", "sent", "failed"],
            },
            templateType: {
              type: "string",
              description: "Filter by template type (absent, fee_due, fee_paid, etc.)",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    orgId: { type: "string" },
                    branchId: { type: "string" },
                    recipientPhone: { type: "string" },
                    templateId: { type: "string" },
                    status: { type: "string" },
                    providerMessageId: { type: "string", nullable: true },
                    errorMessage: { type: "string", nullable: true },
                    entityType: { type: "string", nullable: true },
                    entityId: { type: "string", nullable: true },
                    sentAt: { type: "string", format: "date-time" },
                    template: {
                      type: "object",
                      properties: {
                        type: { type: "string" },
                        name: { type: "string", nullable: true },
                      },
                    },
                  },
                },
              },
              pagination: paginationResponseOpenApi,
            },
          },
        },
      },
    },
    listNotifications
  );

  // GET /notifications/stats - Get notification statistics
  fastify.get(
    "/stats",
    {
      preHandler: [requirePermission(PERMISSIONS.SETTINGS_MANAGE)],
      schema: {
        tags: ["Notifications"],
        summary: "Get notification statistics",
        description: "Get notification statistics for today, last 7 days, and last 30 days",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              today: {
                type: "object",
                properties: {
                  total: { type: "number" },
                  sent: { type: "number" },
                  failed: { type: "number" },
                  pending: { type: "number" },
                },
              },
              last7Days: {
                type: "object",
                properties: {
                  total: { type: "number" },
                  sent: { type: "number" },
                  failed: { type: "number" },
                  pending: { type: "number" },
                },
              },
              last30Days: {
                type: "object",
                properties: {
                  total: { type: "number" },
                  sent: { type: "number" },
                  failed: { type: "number" },
                  pending: { type: "number" },
                },
              },
              allTime: {
                type: "object",
                properties: {
                  total: { type: "number" },
                  sent: { type: "number" },
                  failed: { type: "number" },
                  pending: { type: "number" },
                },
              },
              byType: {
                type: "object",
                additionalProperties: { type: "number" },
              },
            },
          },
        },
      },
    },
    getNotificationStats
  );

  // GET /notifications/:id - Get single notification
  fastify.get(
    "/:id",
    {
      preHandler: [requirePermission(PERMISSIONS.SETTINGS_MANAGE)],
      schema: {
        tags: ["Notifications"],
        summary: "Get notification details",
        description: "Get details of a specific notification",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              orgId: { type: "string" },
              branchId: { type: "string" },
              recipientPhone: { type: "string" },
              templateId: { type: "string" },
              status: { type: "string" },
              providerMessageId: { type: "string", nullable: true },
              errorMessage: { type: "string", nullable: true },
              entityType: { type: "string", nullable: true },
              entityId: { type: "string", nullable: true },
              sentAt: { type: "string", format: "date-time" },
              template: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  name: { type: "string", nullable: true },
                  content: { type: "string" },
                },
              },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    getNotification
  );

  // POST /notifications/:id/retry - Retry a failed notification
  fastify.post(
    "/:id/retry",
    {
      preHandler: [requirePermission(PERMISSIONS.SETTINGS_MANAGE)],
      schema: {
        tags: ["Notifications"],
        summary: "Retry failed notification",
        description: "Retry sending a failed notification",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    retryNotification
  );
}
