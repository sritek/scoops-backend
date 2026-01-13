import type { FastifyInstance } from "fastify";
import { branchContextMiddleware } from "../../middleware/branch.middleware.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions.js";
import * as controller from "./fees.controller.js";

/**
 * Fees module routes
 * All routes require authentication (applied globally) and branch context
 */
export async function feesRoutes(app: FastifyInstance) {
  /**
   * GET /fees/plans
   * List all fee plans in the branch
   * Requires: FEE_VIEW
   */
  app.get(
    "/plans",
    {
      schema: {
        tags: ["Fees"],
        summary: "List all fee plans",
        description: "Returns all active fee plans in the current branch",
        security: [{ bearerAuth: [] }],
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
   * Get all pending fees in the branch
   * Requires: FEE_VIEW
   */
  app.get(
    "/pending",
    {
      schema: {
        tags: ["Fees"],
        summary: "List pending fees",
        description: "Returns all pending and partial fees in the current branch",
        security: [{ bearerAuth: [] }],
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
        description: "Returns all fees and payment history for a specific student",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            studentId: { type: "string", format: "uuid", description: "Student ID" },
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
            dueDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Due date in YYYY-MM-DD format" },
            totalAmount: { type: "integer", minimum: 1, description: "Optional override of fee plan amount" },
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
        description: "Records a payment for a student fee. Partial payments are allowed. Amount cannot exceed pending amount.",
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
}
