import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import { parsePaginationParams } from "../../utils/pagination.js";
import {
  createEMIPlanTemplateSchema,
  updateEMIPlanTemplateSchema,
  emiTemplateIdParamSchema,
  generateInstallmentsSchema,
  recordInstallmentPaymentSchema,
  installmentIdParamSchema,
  studentIdParamSchema,
  listPendingInstallmentsQuerySchema,
} from "./installments.schema.js";
import * as installmentsService from "./installments.service.js";

// =====================
// EMI Plan Template Handlers
// =====================

/**
 * GET /emi-templates
 * List EMI plan templates
 */
export async function listEMIPlanTemplates(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const templates = await installmentsService.getEMIPlanTemplates(scope);

  return reply.code(200).send({
    data: templates,
  });
}

/**
 * GET /emi-templates/:id
 * Get EMI plan template by ID
 */
export async function getEMIPlanTemplate(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = emiTemplateIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid template ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const template = await installmentsService.getEMIPlanTemplateById(params.data.id, scope);

  return reply.code(200).send({
    data: template,
  });
}

/**
 * POST /emi-templates
 * Create EMI plan template
 */
export async function createEMIPlanTemplate(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const body = createEMIPlanTemplateSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const template = await installmentsService.createEMIPlanTemplate(body.data, scope);

  return reply.code(201).send({
    data: template,
    message: "EMI plan template created successfully",
  });
}

/**
 * PATCH /emi-templates/:id
 * Update EMI plan template
 */
export async function updateEMIPlanTemplate(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = emiTemplateIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid template ID",
      details: params.error.flatten(),
    });
  }

  const body = updateEMIPlanTemplateSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const template = await installmentsService.updateEMIPlanTemplate(
    params.data.id,
    body.data,
    scope
  );

  return reply.code(200).send({
    data: template,
    message: "EMI plan template updated successfully",
  });
}

// =====================
// Installment Handlers
// =====================

/**
 * POST /fees/installments/generate
 * Generate installments for a fee structure
 */
export async function generateInstallments(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const body = generateInstallmentsSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const installments = await installmentsService.generateInstallments(body.data, scope);

  return reply.code(201).send({
    data: installments,
    message: `Generated ${installments.length} installments`,
  });
}

/**
 * GET /fees/installments/:studentId
 * Get installments for a student
 */
export async function getStudentInstallments(
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

  const sessionId = (request.query as { sessionId?: string }).sessionId;
  const scope = getTenantScopeFromRequest(request);
  const installments = await installmentsService.getStudentInstallments(
    params.data.studentId,
    sessionId,
    scope
  );

  return reply.code(200).send({
    data: installments,
  });
}

/**
 * POST /fees/installments/:id/payment
 * Record payment for an installment
 */
export async function recordInstallmentPayment(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = installmentIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid installment ID",
      details: params.error.flatten(),
    });
  }

  const body = recordInstallmentPaymentSchema.safeParse({
    ...request.body as object,
    installmentId: params.data.id,
  });
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const { userId } = request.userContext;
  const result = await installmentsService.recordInstallmentPayment(body.data, userId, scope);

  return reply.code(200).send({
    data: result,
    message: "Payment recorded successfully",
  });
}

/**
 * GET /fees/installments/pending
 * List pending installments
 */
export async function listPendingInstallments(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const query = listPendingInstallmentsQuerySchema.safeParse(request.query);
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
    status: query.data.status,
    batchId: query.data.batchId,
    search: query.data.search,
  };

  const result = await installmentsService.getPendingInstallments(scope, pagination, filters);

  return reply.code(200).send(result);
}

/**
 * DELETE /fees/installments/:id
 * Delete installments for a fee structure
 */
export async function deleteInstallments(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const feeStructureId = (request.query as { feeStructureId: string }).feeStructureId;
  if (!feeStructureId) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Fee structure ID is required",
    });
  }

  const scope = getTenantScopeFromRequest(request);
  await installmentsService.deleteInstallments(feeStructureId, scope);

  return reply.code(200).send({
    message: "Installments deleted successfully",
  });
}
