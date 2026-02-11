import type { FastifyInstance } from "fastify";
import { branchContextMiddleware } from "../../middleware/branch.middleware.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions";
import {
  paginationQueryOpenApi,
  paginationResponseOpenApi,
} from "../../utils/pagination.js";
import * as controller from "./installments.controller.js";

/**
 * Installments module routes
 */
export async function installmentsRoutes(app: FastifyInstance) {
  // =====================
  // EMI Plan Template Routes
  // =====================

  /**
   * GET /emi-templates
   * List EMI plan templates
   * Requires: FEE_VIEW
   */
  app.get(
    "/",
    {
      schema: {
        tags: ["EMI Templates"],
        summary: "List EMI plan templates",
        description: "Returns all active EMI plan templates for the organization",
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
    controller.listEMIPlanTemplates
  );

  /**
   * GET /emi-templates/:id
   * Get EMI plan template by ID
   * Requires: FEE_VIEW
   */
  app.get(
    "/:id",
    {
      schema: {
        tags: ["EMI Templates"],
        summary: "Get EMI plan template",
        description: "Returns details of a specific EMI plan template",
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
    controller.getEMIPlanTemplate
  );

  /**
   * POST /emi-templates
   * Create EMI plan template
   * Requires: FEE_UPDATE
   */
  app.post(
    "/",
    {
      schema: {
        tags: ["EMI Templates"],
        summary: "Create EMI plan template",
        description: "Creates a new EMI plan template",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name", "installmentCount", "splitConfig"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            installmentCount: { type: "integer", minimum: 1, maximum: 24 },
            splitConfig: {
              type: "array",
              items: {
                type: "object",
                required: ["percent", "dueDaysFromStart"],
                properties: {
                  percent: { type: "number", minimum: 1, maximum: 100 },
                  dueDaysFromStart: { type: "integer", minimum: 0 },
                },
              },
            },
            isDefault: { type: "boolean", default: false },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_UPDATE),
      ],
    },
    controller.createEMIPlanTemplate
  );

  /**
   * PATCH /emi-templates/:id
   * Update EMI plan template
   * Requires: FEE_UPDATE
   */
  app.patch(
    "/:id",
    {
      schema: {
        tags: ["EMI Templates"],
        summary: "Update EMI plan template",
        description: "Updates an existing EMI plan template",
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
            name: { type: "string", minLength: 1, maxLength: 100 },
            splitConfig: {
              type: "array",
              items: {
                type: "object",
                required: ["percent", "dueDaysFromStart"],
                properties: {
                  percent: { type: "number", minimum: 1, maximum: 100 },
                  dueDaysFromStart: { type: "integer", minimum: 0 },
                },
              },
            },
            isDefault: { type: "boolean" },
            isActive: { type: "boolean" },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_UPDATE),
      ],
    },
    controller.updateEMIPlanTemplate
  );
}

/**
 * Fee installment routes (mounted under /fees/installments)
 */
export async function feeInstallmentsRoutes(app: FastifyInstance) {
  /**
   * GET /fees/installments/pending
   * List pending installments
   * Requires: FEE_VIEW
   */
  app.get(
    "/pending",
    {
      schema: {
        tags: ["Installments"],
        summary: "List pending installments",
        description: "Returns paginated pending installments",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            ...paginationQueryOpenApi.properties,
            status: {
              type: "string",
              enum: ["upcoming", "due", "overdue", "partial", "paid"],
              description: "Filter by installment status (including paid)",
            },
            batchId: {
              type: "string",
              format: "uuid",
              description: "Filter by batch",
            },
            search: {
              type: "string",
              description: "Search by student name",
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
    controller.listPendingInstallments
  );

  /**
   * POST /fees/installments/generate
   * Generate installments for a fee structure
   * Requires: FEE_UPDATE
   */
  app.post(
    "/generate",
    {
      schema: {
        tags: ["Installments"],
        summary: "Generate installments",
        description: "Generates installments for a student fee structure using an EMI template",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["studentFeeStructureId", "emiTemplateId", "startDate"],
          properties: {
            studentFeeStructureId: { type: "string", format: "uuid" },
            emiTemplateId: { type: "string", format: "uuid" },
            startDate: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}$",
              description: "Start date for installments (YYYY-MM-DD)",
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_UPDATE),
      ],
    },
    controller.generateInstallments
  );

  /**
   * GET /fees/installments/:studentId
   * Get installments for a student
   * Requires: FEE_VIEW
   */
  app.get(
    "/:studentId",
    {
      schema: {
        tags: ["Installments"],
        summary: "Get student installments",
        description: "Returns all installments for a student",
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
    controller.getStudentInstallments
  );

  /**
   * POST /fees/installments/:id/payment
   * Record payment for an installment
   * Requires: FEE_UPDATE
   */
  app.post(
    "/:id/payment",
    {
      schema: {
        tags: ["Installments"],
        summary: "Record installment payment",
        description: "Records a payment for a specific installment",
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
          required: ["amount", "paymentMode"],
          properties: {
            amount: { type: "number", minimum: 1 },
            paymentMode: { type: "string", enum: ["cash", "upi", "bank"] },
            transactionRef: { type: "string", maxLength: 100 },
            remarks: { type: "string", maxLength: 500 },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_UPDATE),
      ],
    },
    controller.recordInstallmentPayment
  );

  /**
   * DELETE /fees/installments
   * Delete installments for a fee structure
   * Requires: FEE_UPDATE
   */
  app.delete(
    "/",
    {
      schema: {
        tags: ["Installments"],
        summary: "Delete installments",
        description: "Deletes all installments for a fee structure (only if no payments)",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            feeStructureId: {
              type: "string",
              format: "uuid",
              description: "Fee structure ID",
            },
          },
          required: ["feeStructureId"],
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.FEE_UPDATE),
      ],
    },
    controller.deleteInstallments
  );
}
