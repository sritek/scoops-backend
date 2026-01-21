/**
 * Messaging Routes
 */

import type { FastifyInstance } from "fastify";
import { branchContextMiddleware } from "../../middleware/branch.middleware.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions";
import * as controller from "./messaging.controller.js";

export async function messagingRoutes(app: FastifyInstance) {
  /**
   * GET /messages/unread
   */
  app.get(
    "/unread",
    {
      schema: {
        tags: ["Messaging"],
        summary: "Get unread count",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [branchContextMiddleware, requirePermission(PERMISSIONS.DASHBOARD_VIEW)],
    },
    controller.getUnreadCount
  );

  /**
   * POST /messages/conversations
   */
  app.post(
    "/conversations",
    {
      schema: {
        tags: ["Messaging"],
        summary: "Create conversation",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["type", "initialMessage"],
          properties: {
            type: { type: "string", enum: ["direct", "broadcast", "announcement"] },
            title: { type: "string" },
            batchId: { type: "string" },
            participantUserIds: { type: "array", items: { type: "string" } },
            participantParentIds: { type: "array", items: { type: "string" } },
            initialMessage: { type: "string" },
          },
        },
      },
      preHandler: [branchContextMiddleware, requirePermission(PERMISSIONS.DASHBOARD_VIEW)],
    },
    controller.createConversation
  );

  /**
   * GET /messages/conversations
   */
  app.get(
    "/conversations",
    {
      schema: {
        tags: ["Messaging"],
        summary: "List conversations",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            page: { type: "number" },
            limit: { type: "number" },
          },
        },
      },
      preHandler: [branchContextMiddleware, requirePermission(PERMISSIONS.DASHBOARD_VIEW)],
    },
    controller.listConversations
  );

  /**
   * GET /messages/conversations/:id
   */
  app.get(
    "/conversations/:id",
    {
      schema: {
        tags: ["Messaging"],
        summary: "Get conversation",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
      preHandler: [branchContextMiddleware, requirePermission(PERMISSIONS.DASHBOARD_VIEW)],
    },
    controller.getConversation
  );

  /**
   * POST /messages/conversations/:id/messages
   */
  app.post(
    "/conversations/:id/messages",
    {
      schema: {
        tags: ["Messaging"],
        summary: "Send message",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["content"],
          properties: {
            content: { type: "string" },
            attachmentUrl: { type: "string" },
          },
        },
      },
      preHandler: [branchContextMiddleware, requirePermission(PERMISSIONS.DASHBOARD_VIEW)],
    },
    controller.sendMessage
  );

  /**
   * POST /messages/broadcast
   */
  app.post(
    "/broadcast",
    {
      schema: {
        tags: ["Messaging"],
        summary: "Create broadcast",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["batchId", "title", "message"],
          properties: {
            batchId: { type: "string" },
            title: { type: "string" },
            message: { type: "string" },
          },
        },
      },
      preHandler: [branchContextMiddleware, requirePermission(PERMISSIONS.ATTENDANCE_MARK)],
    },
    controller.createBroadcast
  );
}
