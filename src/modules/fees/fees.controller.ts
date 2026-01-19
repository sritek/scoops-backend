import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import { parsePaginationParams } from "../../utils/pagination.js";
import {
  createFeePlanSchema,
  assignFeeSchema,
  recordPaymentSchema,
  studentIdParamSchema,
  listFeePlansQuerySchema,
  listPendingFeesQuerySchema,
  listReceiptsQuerySchema,
  receiptIdParamSchema,
} from "./fees.schema.js";
import * as feesService from "./fees.service.js";
import * as receiptService from "./receipt.service.js";

/**
 * GET /fees/plans
 * List fee plans with pagination
 */
export async function listFeePlans(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  // Parse and validate query params
  const query = listFeePlansQuerySchema.safeParse(request.query);
  if (!query.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid query parameters",
      details: query.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const pagination = parsePaginationParams({
    page: String(query.data.page),
    limit: String(query.data.limit),
  });
  const filters = {
    isActive: query.data.isActive,
  };

  const result = await feesService.getFeePlans(scope, pagination, filters);

  return reply.code(200).send(result);
}

/**
 * POST /fees/plan
 * Create a new fee plan
 */
export async function createFeePlan(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const body = createFeePlanSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const plan = await feesService.createFeePlan(body.data, scope);

  return reply.code(201).send({
    data: plan,
    message: "Fee plan created successfully",
  });
}

/**
 * GET /fees/pending
 * Get pending fees with pagination
 * Teachers only see fees for students in their batch
 */
export async function getPendingFees(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  // Parse and validate query params
  const query = listPendingFeesQuerySchema.safeParse(request.query);
  if (!query.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid query parameters",
      details: query.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const { userId, role } = request.userContext;
  const pagination = parsePaginationParams({
    page: String(query.data.page),
    limit: String(query.data.limit),
  });
  const filters = {
    status: query.data.status,
    studentId: query.data.studentId,
  };

  // Use role-based filtering (teachers only see their batch fees)
  const result = await feesService.getPendingFeesForRole(
    scope,
    pagination,
    role,
    userId,
    filters
  );

  return reply.code(200).send(result);
}

/**
 * GET /fees/student/:studentId
 * Get fee details for a specific student
 */
export async function getStudentFees(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = studentIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid student ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const result = await feesService.getStudentFees(params.data.studentId, scope);

  if (!result) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Student not found",
    });
  }

  return reply.code(200).send({
    data: result,
  });
}

/**
 * POST /fees/assign
 * Assign a fee to a student
 */
export async function assignFee(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const body = assignFeeSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const { userId } = request.userContext;
  const fee = await feesService.assignFee(body.data, userId, scope);

  return reply.code(201).send({
    data: fee,
    message: "Fee assigned successfully",
  });
}

/**
 * POST /fees/payment
 * Record a payment for a student fee
 */
export async function recordPayment(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const body = recordPaymentSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const { userId } = request.userContext;
  const result = await feesService.recordPayment(body.data, userId, scope);

  // Automatically create a receipt for the payment
  const receipt = await receiptService.createReceipt(result.payment.id, scope, userId);

  // Use 200 OK since we're updating an existing fee record
  return reply.code(200).send({
    data: {
      ...result,
      receipt,
    },
    message: "Payment recorded successfully",
  });
}

// =====================
// Receipt Handlers
// =====================

/**
 * GET /fees/receipts
 * List receipts with pagination
 */
export async function listReceipts(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const query = listReceiptsQuerySchema.safeParse(request.query);
  if (!query.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid query parameters",
      details: query.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const pagination = parsePaginationParams({
    page: String(query.data.page),
    limit: String(query.data.limit),
  });
  const filters = {
    studentId: query.data.studentId,
    startDate: query.data.startDate,
    endDate: query.data.endDate,
    search: query.data.search,
  };

  const result = await receiptService.getReceipts(scope, pagination, filters);

  return reply.code(200).send(result);
}

/**
 * GET /fees/receipts/:id
 * Get receipt details
 */
export async function getReceipt(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = receiptIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid receipt ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const receipt = await receiptService.getReceiptById(params.data.id, scope);

  if (!receipt) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Receipt not found",
    });
  }

  return reply.code(200).send({ data: receipt });
}

/**
 * GET /fees/receipts/:id/pdf
 * Download receipt as PDF
 */
export async function downloadReceiptPDF(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = receiptIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid receipt ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const result = await receiptService.generateReceiptPDF(params.data.id, scope);

  if (!result) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Receipt not found",
    });
  }

  // Set headers for PDF download
  reply.header("Content-Type", "application/pdf");
  reply.header("Content-Disposition", `attachment; filename="${result.fileName}"`);

  return reply.send(result.stream);
}

/**
 * POST /fees/receipts/:id/send
 * Send receipt via WhatsApp
 */
export async function sendReceiptViaWhatsApp(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = receiptIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid receipt ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const receipt = await receiptService.getReceiptById(params.data.id, scope);

  if (!receipt) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Receipt not found",
    });
  }

  // TODO: Implement WhatsApp sending via Gupshup
  // For now, return a placeholder response
  return reply.code(200).send({
    message: "Receipt notification queued for sending",
    data: {
      receiptId: receipt.id,
      receiptNumber: receipt.receiptNumber,
      studentName: receipt.student.fullName,
    },
  });
}
