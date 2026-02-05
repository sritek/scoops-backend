import type { FastifyInstance } from "fastify";
import { branchContextMiddleware } from "../../middleware/branch.middleware.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions";
import {
  paginationQueryOpenApi,
  paginationResponseOpenApi,
} from "../../utils/pagination.js";
import * as controller from "./fees.controller.js";

/**
 * Fees module routes
 * All routes require authentication (applied globally) and branch context
 *
 * Note: Legacy endpoints (/plans, /pending, /assign, /payment, /student/:studentId)
 * have been removed as part of the fee module consolidation.
 * Use the installments module for payment-related operations.
 */
export async function feesRoutes(app: FastifyInstance) {
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
    controller.listReceipts,
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
    controller.getReceipt,
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
    controller.downloadReceiptPDF,
  );

  /**
   * GET /fees/payments/:paymentId/summary-pdf
   * Download payment summary as PDF
   * Requires: FEE_VIEW
   */
  app.get(
    "/payments/:paymentId/summary-pdf",
    {
      schema: {
        tags: ["Payments"],
        summary: "Download payment summary PDF",
        description: "Generates and downloads a payment summary as a PDF file",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            paymentId: { type: "string", format: "uuid" },
          },
          required: ["paymentId"],
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
    controller.downloadPaymentSummaryPDF,
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
    controller.sendReceiptViaWhatsApp,
  );

  // =====================
  // Fee Component Routes
  // =====================

  /**
   * GET /fees/components
   * List fee components with pagination
   * Requires: FEE_VIEW
   */
  app.get(
    "/components",
    {
      schema: {
        tags: ["Fee Components"],
        summary: "List fee components",
        description: "Returns paginated fee components for the organization",
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
            type: {
              type: "string",
              enum: [
                "tuition",
                "admission",
                "transport",
                "lab",
                "library",
                "sports",
                "exam",
                "uniform",
                "misc",
              ],
              description: "Filter by component type",
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
        requirePermission(PERMISSIONS.FEE_VIEW),
      ],
    },
    controller.listFeeComponents,
  );

  /**
   * GET /fees/components/all
   * Get all active fee components (for dropdowns)
   * Requires: FEE_VIEW
   */
  app.get(
    "/components/all",
    {
      schema: {
        tags: ["Fee Components"],
        summary: "Get all fee components",
        description: "Returns all active fee components (for dropdown menus)",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "array",
                items: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_VIEW),
      ],
    },
    controller.getAllFeeComponents,
  );

  /**
   * GET /fees/components/:id
   * Get a single fee component
   * Requires: FEE_VIEW
   */
  app.get(
    "/components/:id",
    {
      schema: {
        tags: ["Fee Components"],
        summary: "Get fee component",
        description: "Returns details of a specific fee component",
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
    controller.getFeeComponent,
  );

  /**
   * POST /fees/components
   * Create a new fee component
   * Requires: FEE_UPDATE
   */
  app.post(
    "/components",
    {
      schema: {
        tags: ["Fee Components"],
        summary: "Create fee component",
        description: "Creates a new fee component for the organization",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name", "type"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 255 },
            type: {
              type: "string",
              enum: [
                "tuition",
                "admission",
                "transport",
                "lab",
                "library",
                "sports",
                "exam",
                "uniform",
                "misc",
              ],
            },
            description: { type: "string", maxLength: 500 },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_UPDATE),
      ],
    },
    controller.createFeeComponent,
  );

  /**
   * PATCH /fees/components/:id
   * Update a fee component
   * Requires: FEE_UPDATE
   */
  app.patch(
    "/components/:id",
    {
      schema: {
        tags: ["Fee Components"],
        summary: "Update fee component",
        description: "Updates an existing fee component",
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
            description: { type: "string", maxLength: 500 },
            isActive: { type: "boolean" },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_UPDATE),
      ],
    },
    controller.updateFeeComponent,
  );

  /**
   * DELETE /fees/components/:id
   * Deactivate a fee component
   * Requires: FEE_UPDATE
   */
  app.delete(
    "/components/:id",
    {
      schema: {
        tags: ["Fee Components"],
        summary: "Deactivate fee component",
        description: "Deactivates a fee component (soft delete)",
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
        requirePermission(PERMISSIONS.FEE_UPDATE),
      ],
    },
    controller.deleteFeeComponent,
  );

  // =====================
  // Batch Fee Structure Routes
  // =====================

  /**
   * GET /fees/batch-structure
   * List all batch fee structures
   * Requires: FEE_VIEW
   */
  app.get(
    "/batch-structure",
    {
      schema: {
        tags: ["Batch Fee Structure"],
        summary: "List batch fee structures",
        description: "Returns all batch fee structures for the branch",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              format: "uuid",
              description: "Filter by academic session",
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
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_VIEW),
      ],
    },
    controller.listBatchFeeStructures,
  );

  /**
   * GET /fees/batch-structure/:batchId
   * Get batch fee structure by batch ID
   * Requires: FEE_VIEW
   */
  app.get(
    "/batch-structure/:batchId",
    {
      schema: {
        tags: ["Batch Fee Structure"],
        summary: "Get batch fee structure",
        description:
          "Returns the fee structure for a specific batch and session",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            batchId: { type: "string", format: "uuid" },
          },
          required: ["batchId"],
        },
        querystring: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              format: "uuid",
              description: "Academic session ID (required)",
            },
          },
          required: ["sessionId"],
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_VIEW),
      ],
    },
    controller.getBatchFeeStructure,
  );

  /**
   * POST /fees/batch-structure
   * Create or update batch fee structure
   * Requires: FEE_UPDATE
   */
  app.post(
    "/batch-structure",
    {
      schema: {
        tags: ["Batch Fee Structure"],
        summary: "Create batch fee structure",
        description: "Creates or updates a fee structure for a batch",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["batchId", "sessionId", "name", "lineItems"],
          properties: {
            batchId: { type: "string", format: "uuid" },
            sessionId: { type: "string", format: "uuid" },
            name: { type: "string", minLength: 1, maxLength: 255 },
            lineItems: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["feeComponentId", "amount"],
                properties: {
                  feeComponentId: { type: "string", format: "uuid" },
                  amount: { type: "number", minimum: 0 },
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
    controller.createBatchFeeStructure,
  );

  /**
   * PATCH /fees/batch-structure/:id
   * Update batch fee structure
   * Requires: FEE_UPDATE
   */
  app.patch(
    "/batch-structure/:id",
    {
      schema: {
        tags: ["Batch Fee Structure"],
        summary: "Update batch fee structure",
        description: "Updates an existing batch fee structure",
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
            lineItems: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["feeComponentId", "amount"],
                properties: {
                  feeComponentId: { type: "string", format: "uuid" },
                  amount: { type: "number", minimum: 0 },
                },
              },
            },
            isActive: { type: "boolean" },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_UPDATE),
      ],
    },
    controller.updateBatchFeeStructure,
  );

  /**
   * POST /fees/batch-structure/:id/apply
   * Apply batch fee structure to all students
   * Requires: FEE_UPDATE
   */
  app.post(
    "/batch-structure/:id/apply",
    {
      schema: {
        tags: ["Batch Fee Structure"],
        summary: "Apply to students",
        description:
          "Applies the batch fee structure to all active students in the batch",
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
            overwriteExisting: {
              type: "boolean",
              description:
                "Whether to overwrite existing student fee structures",
              default: false,
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_UPDATE),
      ],
    },
    controller.applyBatchFeeStructureToStudents,
  );

  // =====================
  // Student Fee Structure Routes
  // =====================

  /**
   * GET /fees/student-structure/:studentId
   * Get student fee structure
   * Requires: FEE_VIEW
   */
  app.get(
    "/student-structure/:studentId",
    {
      schema: {
        tags: ["Student Fee Structure"],
        summary: "Get student fee structure",
        description:
          "Returns the fee structure for a specific student and session",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            studentId: { type: "string", format: "uuid" },
          },
          required: ["studentId"],
        },
        querystring: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              format: "uuid",
              description: "Academic session ID (required)",
            },
          },
          required: ["sessionId"],
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_VIEW),
      ],
    },
    controller.getStudentFeeStructure,
  );

  /**
   * GET /fees/student-structure/id/:id
   * Get student fee structure by ID
   * Requires: FEE_VIEW
   */
  app.get(
    "/student-structure/id/:id",
    {
      schema: {
        tags: ["Student Fee Structure"],
        summary: "Get student fee structure by ID",
        description: "Returns detailed fee structure including installments",
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
    controller.getStudentFeeStructureById,
  );

  /**
   * POST /fees/student-structure
   * Create custom student fee structure
   * Requires: FEE_UPDATE
   */
  app.post(
    "/student-structure",
    {
      schema: {
        tags: ["Student Fee Structure"],
        summary: "Create student fee structure",
        description: "Creates a custom fee structure for a student",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["studentId", "sessionId", "lineItems"],
          properties: {
            studentId: { type: "string", format: "uuid" },
            sessionId: { type: "string", format: "uuid" },
            lineItems: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: [
                  "feeComponentId",
                  "originalAmount",
                  "adjustedAmount",
                ],
                properties: {
                  feeComponentId: { type: "string", format: "uuid" },
                  originalAmount: { type: "number", minimum: 0 },
                  adjustedAmount: { type: "number", minimum: 0 },
                  waived: { type: "boolean", default: false },
                  waiverReason: { type: "string", maxLength: 255 },
                },
              },
            },
            remarks: { type: "string", maxLength: 500 },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_UPDATE),
      ],
    },
    controller.createStudentFeeStructure,
  );

  /**
   * PATCH /fees/student-structure/:id
   * Update student fee structure
   * Requires: FEE_UPDATE
   */
  app.patch(
    "/student-structure/:id",
    {
      schema: {
        tags: ["Student Fee Structure"],
        summary: "Update student fee structure",
        description: "Updates an existing student fee structure",
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
            lineItems: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: [
                  "feeComponentId",
                  "originalAmount",
                  "adjustedAmount",
                ],
                properties: {
                  feeComponentId: { type: "string", format: "uuid" },
                  originalAmount: { type: "number", minimum: 0 },
                  adjustedAmount: { type: "number", minimum: 0 },
                  waived: { type: "boolean" },
                  waiverReason: { type: "string", maxLength: 255 },
                },
              },
            },
            remarks: { type: "string", maxLength: 500, nullable: true },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_UPDATE),
      ],
    },
    controller.updateStudentFeeStructure,
  );

  /**
   * GET /fees/student-structure/summary/:studentId
   * Get student fee summary
   * Requires: FEE_VIEW
   */
  app.get(
    "/student-structure/summary/:studentId",
    {
      schema: {
        tags: ["Student Fee Structure"],
        summary: "Get student fee summary",
        description:
          "Returns a summary of all fee structures and payments for a student",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            studentId: { type: "string", format: "uuid" },
          },
          required: ["studentId"],
        },
        querystring: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              format: "uuid",
              description: "Filter by academic session",
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_VIEW),
      ],
    },
    controller.getStudentFeeSummary,
  );
}
