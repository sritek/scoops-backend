import type { FastifyInstance } from "fastify";
import { branchContextMiddleware } from "../../middleware/branch.middleware.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions.js";
import {
  paginationQueryOpenApi,
  paginationResponseOpenApi,
} from "../../utils/pagination.js";
import * as controller from "./fees.controller.js";

/**
 * Fees module routes
 * All routes require authentication (applied globally) and branch context
 */
export async function feesRoutes(app: FastifyInstance) {
  /**
   * GET /fees/plans
   * List fee plans with pagination
   * Requires: FEE_VIEW
   */
  app.get(
    "/plans",
    {
      schema: {
        tags: ["Fees"],
        summary: "List fee plans",
        description: "Returns paginated fee plans in the current branch",
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
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "array",
                items: { type: "object", additionalProperties: true },
                description: "Array of fee plans",
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
    controller.listFeePlans
  );

  /**
   * POST /fees/plan
   * Create a new fee plan
   * Requires: FEE_UPDATE
   */
  app.post(
    "/plan",
    {
      schema: {
        tags: ["Fees"],
        summary: "Create a fee plan",
        description: "Creates a new fee plan/template for the branch",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name", "amount", "frequency"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 255 },
            amount: { type: "integer", minimum: 1 },
            frequency: { type: "string", enum: ["monthly", "custom"] },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_UPDATE),
      ],
    },
    controller.createFeePlan
  );

  /**
   * GET /fees/pending
   * Get pending fees with pagination
   * Requires: FEE_VIEW
   */
  app.get(
    "/pending",
    {
      schema: {
        tags: ["Fees"],
        summary: "List pending fees",
        description:
          "Returns paginated pending and partial fees in the current branch",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            ...paginationQueryOpenApi.properties,
            status: {
              type: "string",
              enum: ["pending", "partial"],
              description: "Filter by fee status",
            },
            studentId: {
              type: "string",
              format: "uuid",
              description: "Filter by student ID",
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
                description: "Array of pending fees",
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
    controller.getPendingFees
  );

  /**
   * GET /fees/student/:studentId
   * Get fee details for a specific student
   * Requires: FEE_VIEW
   */
  app.get(
    "/student/:studentId",
    {
      schema: {
        tags: ["Fees"],
        summary: "Get student fees",
        description:
          "Returns all fees and payment history for a specific student",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            studentId: {
              type: "string",
              format: "uuid",
              description: "Student ID",
            },
          },
          required: ["studentId"],
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_VIEW),
      ],
    },
    controller.getStudentFees
  );

  /**
   * POST /fees/assign
   * Assign a fee to a student
   * Requires: FEE_UPDATE
   */
  app.post(
    "/assign",
    {
      schema: {
        tags: ["Fees"],
        summary: "Assign fee to student",
        description: "Assigns a fee plan to a student with a due date",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["studentId", "feePlanId", "dueDate"],
          properties: {
            studentId: { type: "string", format: "uuid" },
            feePlanId: { type: "string", format: "uuid" },
            dueDate: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}$",
              description: "Due date in YYYY-MM-DD format",
            },
            totalAmount: {
              type: "integer",
              minimum: 1,
              description: "Optional override of fee plan amount",
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_UPDATE),
      ],
    },
    controller.assignFee
  );

  /**
   * POST /fees/payment
   * Record a payment for a student fee
   * Requires: FEE_UPDATE
   */
  app.post(
    "/payment",
    {
      schema: {
        tags: ["Fees"],
        summary: "Record a payment",
        description:
          "Records a payment for a student fee. Partial payments are allowed. Amount cannot exceed pending amount.",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["studentFeeId", "amount", "paymentMode"],
          properties: {
            studentFeeId: { type: "string", format: "uuid" },
            amount: { type: "integer", minimum: 1 },
            paymentMode: { type: "string", enum: ["cash", "upi", "bank"] },
            notes: { type: "string", maxLength: 500 },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_UPDATE),
      ],
    },
    controller.recordPayment
  );

  // =====================
  // Receipt Routes
  // =====================

  /**
   * GET /fees/receipts
   * List receipts with pagination and filters
   * Requires: FEE_VIEW
   */
  app.get(
    "/receipts",
    {
      schema: {
        tags: ["Receipts"],
        summary: "List receipts",
        description: "Returns paginated receipts with optional filters",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            ...paginationQueryOpenApi.properties,
            studentId: { type: "string", format: "uuid" },
            startDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            endDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            search: { type: "string" },
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
    controller.listReceipts
  );

  /**
   * GET /fees/receipts/:id
   * Get receipt details
   * Requires: FEE_VIEW
   */
  app.get(
    "/receipts/:id",
    {
      schema: {
        tags: ["Receipts"],
        summary: "Get receipt details",
        description: "Returns detailed information about a specific receipt",
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
    controller.getReceipt
  );

  /**
   * GET /fees/receipts/:id/pdf
   * Download receipt as PDF
   * Requires: FEE_VIEW
   */
  app.get(
    "/receipts/:id/pdf",
    {
      schema: {
        tags: ["Receipts"],
        summary: "Download receipt PDF",
        description: "Generates and downloads the receipt as a PDF file",
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
            type: "string",
            description: "PDF file stream",
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_VIEW),
      ],
    },
    controller.downloadReceiptPDF
  );

  /**
   * POST /fees/receipts/:id/send
   * Send receipt via WhatsApp
   * Requires: FEE_VIEW
   */
  app.post(
    "/receipts/:id/send",
    {
      schema: {
        tags: ["Receipts"],
        summary: "Send receipt via WhatsApp",
        description: "Sends the receipt to the student's parent via WhatsApp",
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
    controller.sendReceiptViaWhatsApp
  );
}
