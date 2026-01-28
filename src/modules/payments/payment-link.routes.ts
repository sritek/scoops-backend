/**
 * Payment Link Routes
 */

import type { FastifyInstance } from "fastify";
import { branchContextMiddleware } from "../../middleware/branch.middleware.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions";
import * as controller from "./payment-link.controller.js";

/**
 * Payment link routes (protected)
 */
export async function paymentLinkRoutes(app: FastifyInstance) {
  /**
   * POST /payment-links
   * Create a new payment link for a fee installment
   */
  app.post(
    "/",
    {
      schema: {
        tags: ["Payment Links"],
        summary: "Create payment link",
        description: "Generate a new payment link for a fee installment",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["installmentId"],
          properties: {
            installmentId: { type: "string", format: "uuid" },
            expiresInDays: { type: "number", minimum: 1, maximum: 30 },
            description: { type: "string", maxLength: 500 },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              data: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  shortCode: { type: "string" },
                  amount: { type: "number" },
                  paymentUrl: { type: "string" },
                  status: { type: "string" },
                  expiresAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_UPDATE),
      ],
    },
    controller.createPaymentLink,
  );

  /**
   * GET /payment-links
   * List payment links
   */
  app.get(
    "/",
    {
      schema: {
        tags: ["Payment Links"],
        summary: "List payment links",
        description: "Get all payment links for the branch",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            page: { type: "number" },
            limit: { type: "number" },
            status: {
              type: "string",
              enum: ["active", "expired", "paid", "cancelled"],
            },
            studentId: { type: "string", format: "uuid" },
            search: { type: "string" },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_VIEW),
      ],
    },
    controller.listPaymentLinks,
  );

  /**
   * GET /payment-links/:id
   * Get payment link by ID
   */
  app.get(
    "/:id",
    {
      schema: {
        tags: ["Payment Links"],
        summary: "Get payment link",
        description: "Get payment link details by ID",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_VIEW),
      ],
    },
    controller.getPaymentLink,
  );

  /**
   * DELETE /payment-links/:id
   * Cancel a payment link
   */
  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Payment Links"],
        summary: "Cancel payment link",
        description: "Cancel an active payment link",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_UPDATE),
      ],
    },
    controller.cancelPaymentLink,
  );
}

/**
 * Public payment routes (no auth required)
 */
export async function publicPaymentRoutes(app: FastifyInstance) {
  /**
   * GET /pay/:shortCode
   * Get payment link details (public)
   */
  app.get(
    "/:shortCode",
    {
      schema: {
        tags: ["Public Payment"],
        summary: "Get payment link (public)",
        description: "Get payment link details for payment page",
        params: {
          type: "object",
          required: ["shortCode"],
          properties: {
            shortCode: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  shortCode: { type: "string" },
                  amount: { type: "number" },
                  description: { type: "string" },
                  status: { type: "string" },
                  expiresAt: { type: "string" },
                  razorpayUrl: { type: "string" },
                  student: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      batchName: { type: "string" },
                    },
                  },
                  session: { type: "string" },
                  installmentNumber: { type: "number" },
                  organization: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      logoUrl: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    controller.getPublicPaymentLink,
  );
}
