import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions.js";
import * as controller from "./settings.controller.js";

/**
 * Settings module routes
 * All routes require SETTINGS_MANAGE permission (admin only)
 */
export async function settingsRoutes(app: FastifyInstance) {
  /**
   * GET /settings/organization
   * Get organization settings
   */
  app.get(
    "/organization",
    {
      schema: {
        tags: ["Settings"],
        summary: "Get organization settings",
        description: "Returns the current organization's settings",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  type: { type: "string" },
                  language: { type: "string" },
                  timezone: { type: "string" },
                  udiseCode: { type: "string", nullable: true },
                  logoUrl: { type: "string", nullable: true },
                  phone: { type: "string", nullable: true },
                  email: { type: "string", nullable: true },
                  address: { type: "string", nullable: true },
                  notificationsEnabled: { type: "boolean" },
                  feeOverdueCheckTime: { type: "string" },
                  feeReminderDays: { type: "number" },
                  birthdayNotifications: { type: "boolean" },
                  attendanceBufferMinutes: { type: "number" },
                  jobsDashboardEnabled: { type: "boolean" },
                  createdAt: { type: "string", format: "date-time" },
                  updatedAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
      },
      preHandler: [requirePermission(PERMISSIONS.SETTINGS_MANAGE)],
    },
    controller.getOrganization
  );

  /**
   * PUT /settings/organization
   * Update organization settings
   */
  app.put(
    "/organization",
    {
      schema: {
        tags: ["Settings"],
        summary: "Update organization settings",
        description: "Updates the current organization's settings",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1, maxLength: 255 },
            type: { type: "string", enum: ["school", "coaching"] },
            language: { type: "string", maxLength: 10 },
            timezone: { type: "string", maxLength: 50 },
            udiseCode: { type: "string", maxLength: 50, nullable: true },
            logoUrl: {
              type: "string",
              description: "Base64 encoded logo image",
              nullable: true,
            },
            phone: { type: "string", minLength: 10, maxLength: 15, nullable: true },
            email: { type: "string", format: "email", nullable: true },
            address: { type: "string", maxLength: 500, nullable: true },
            notificationsEnabled: { type: "boolean" },
            feeOverdueCheckTime: { type: "string", pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$", description: "Time in HH:mm format" },
            feeReminderDays: { type: "number", minimum: 1, maximum: 30 },
            birthdayNotifications: { type: "boolean" },
            attendanceBufferMinutes: { type: "number", minimum: 0, maximum: 60, description: "Minutes after first period to start processing attendance notifications" },
            jobsDashboardEnabled: { type: "boolean" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: { type: "object", additionalProperties: true },
              message: { type: "string" },
            },
          },
        },
      },
      preHandler: [requirePermission(PERMISSIONS.SETTINGS_MANAGE)],
    },
    controller.updateOrganization
  );

  /**
   * GET /settings/message-templates
   * Get all message templates
   */
  app.get(
    "/message-templates",
    {
      schema: {
        tags: ["Settings"],
        summary: "Get all message templates",
        description: "Returns all notification message templates for the organization",
        security: [{ bearerAuth: [] }],
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
                    type: { type: "string" },
                    name: { type: "string", nullable: true },
                    content: { type: "string" },
                    isActive: { type: "boolean" },
                    createdAt: { type: "string", format: "date-time" },
                    updatedAt: { type: "string", format: "date-time", nullable: true },
                  },
                },
              },
            },
          },
        },
      },
      preHandler: [requirePermission(PERMISSIONS.SETTINGS_MANAGE)],
    },
    controller.getMessageTemplates
  );

  /**
   * GET /settings/message-templates/:id
   * Get a single message template
   */
  app.get(
    "/message-templates/:id",
    {
      schema: {
        tags: ["Settings"],
        summary: "Get a message template",
        description: "Returns a single message template by ID",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
      preHandler: [requirePermission(PERMISSIONS.SETTINGS_MANAGE)],
    },
    controller.getMessageTemplate
  );

  /**
   * POST /settings/message-templates
   * Create a message template
   */
  app.post(
    "/message-templates",
    {
      schema: {
        tags: ["Settings"],
        summary: "Create a message template",
        description: "Creates a new notification message template",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["type", "name", "content"],
          properties: {
            type: { type: "string", enum: ["absent", "fee_due", "fee_paid", "fee_overdue", "fee_reminder", "birthday"] },
            name: { type: "string", minLength: 1, maxLength: 255 },
            content: { type: "string", minLength: 1, maxLength: 1000 },
            isActive: { type: "boolean", default: true },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              data: { type: "object", additionalProperties: true },
              message: { type: "string" },
            },
          },
        },
      },
      preHandler: [requirePermission(PERMISSIONS.SETTINGS_MANAGE)],
    },
    controller.createMessageTemplate
  );

  /**
   * PUT /settings/message-templates/:id
   * Update a message template
   */
  app.put(
    "/message-templates/:id",
    {
      schema: {
        tags: ["Settings"],
        summary: "Update a message template",
        description: "Updates an existing message template",
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
            content: { type: "string", minLength: 1, maxLength: 1000 },
            isActive: { type: "boolean" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: { type: "object", additionalProperties: true },
              message: { type: "string" },
            },
          },
        },
      },
      preHandler: [requirePermission(PERMISSIONS.SETTINGS_MANAGE)],
    },
    controller.updateMessageTemplate
  );

  /**
   * DELETE /settings/message-templates/:id
   * Delete a message template
   */
  app.delete(
    "/message-templates/:id",
    {
      schema: {
        tags: ["Settings"],
        summary: "Delete a message template",
        description: "Deletes a message template",
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
              message: { type: "string" },
            },
          },
        },
      },
      preHandler: [requirePermission(PERMISSIONS.SETTINGS_MANAGE)],
    },
    controller.deleteMessageTemplate
  );
}
