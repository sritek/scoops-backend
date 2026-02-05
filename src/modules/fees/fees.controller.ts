import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import { parsePaginationParams } from "../../utils/pagination.js";
import {
  listReceiptsQuerySchema,
  receiptIdParamSchema,
  paymentIdParamSchema,
} from "./fees.schema.js";
import {
  createFeeComponentSchema,
  updateFeeComponentSchema,
  feeComponentIdParamSchema,
  listFeeComponentsQuerySchema,
} from "./fee-components.schema.js";
import {
  createBatchFeeStructureSchema,
  updateBatchFeeStructureSchema,
  batchFeeStructureIdParamSchema,
  batchIdParamSchema,
  applyToStudentsSchema,
} from "./batch-fee-structure.schema.js";
import {
  createStudentFeeStructureSchema,
  updateStudentFeeStructureSchema,
  studentFeeStructureIdParamSchema,
  studentIdParamSchema as studentFeeStructureStudentIdParamSchema,
} from "./student-fee-structure.schema.js";
import * as receiptService from "./receipt.service.js";
import * as feeComponentsService from "./fee-components.service.js";
import * as batchFeeStructureService from "./batch-fee-structure.service.js";
import * as studentFeeStructureService from "./student-fee-structure.service.js";

// =====================
// Receipt Handlers
// =====================

/**
 * GET /fees/receipts
 * List receipts with pagination
 */
export async function listReceipts(
  request: ProtectedRequest,
  reply: FastifyReply,
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
  reply: FastifyReply,
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
  reply: FastifyReply,
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
  reply.header(
    "Content-Disposition",
    `attachment; filename="${result.fileName}"`,
  );

  return reply.send(result.stream);
}

/**
 * GET /fees/payments/:paymentId/summary-pdf
 * Download payment summary as PDF
 */
export async function downloadPaymentSummaryPDF(
  request: ProtectedRequest,
  reply: FastifyReply,
) {
  const params = paymentIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid payment ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const result = await receiptService.generatePaymentSummaryPDF(
    params.data.paymentId,
    scope,
  );

  if (!result) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Payment not found",
    });
  }

  reply.header("Content-Type", "application/pdf");
  reply.header(
    "Content-Disposition",
    `attachment; filename="${result.fileName}"`,
  );

  return reply.send(result.stream);
}

/**
 * POST /fees/receipts/:id/send
 * Send receipt via WhatsApp
 */
export async function sendReceiptViaWhatsApp(
  request: ProtectedRequest,
  reply: FastifyReply,
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

// =====================
// Fee Component Handlers
// =====================

/**
 * GET /fees/components
 * List fee components with pagination
 */
export async function listFeeComponents(
  request: ProtectedRequest,
  reply: FastifyReply,
) {
  const query = listFeeComponentsQuerySchema.safeParse(request.query);
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
    type: query.data.type,
  };

  const result = await feeComponentsService.getFeeComponents(
    scope,
    pagination,
    filters,
  );

  return reply.code(200).send(result);
}

/**
 * GET /fees/components/all
 * Get all active fee components (for dropdowns)
 */
export async function getAllFeeComponents(
  request: ProtectedRequest,
  reply: FastifyReply,
) {
  const scope = getTenantScopeFromRequest(request);
  const components = await feeComponentsService.getAllFeeComponents(scope);

  return reply.code(200).send({
    data: components,
  });
}

/**
 * GET /fees/components/:id
 * Get a single fee component
 */
export async function getFeeComponent(
  request: ProtectedRequest,
  reply: FastifyReply,
) {
  const params = feeComponentIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid fee component ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const component = await feeComponentsService.getFeeComponentById(
    params.data.id,
    scope,
  );

  return reply.code(200).send({
    data: component,
  });
}

/**
 * POST /fees/components
 * Create a new fee component
 */
export async function createFeeComponent(
  request: ProtectedRequest,
  reply: FastifyReply,
) {
  const body = createFeeComponentSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const component = await feeComponentsService.createFeeComponent(
    body.data,
    scope,
  );

  return reply.code(201).send({
    data: component,
    message: "Fee component created successfully",
  });
}

/**
 * PATCH /fees/components/:id
 * Update a fee component
 */
export async function updateFeeComponent(
  request: ProtectedRequest,
  reply: FastifyReply,
) {
  const params = feeComponentIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid fee component ID",
      details: params.error.flatten(),
    });
  }

  const body = updateFeeComponentSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const component = await feeComponentsService.updateFeeComponent(
    params.data.id,
    body.data,
    scope,
  );

  return reply.code(200).send({
    data: component,
    message: "Fee component updated successfully",
  });
}

/**
 * DELETE /fees/components/:id
 * Deactivate a fee component
 */
export async function deleteFeeComponent(
  request: ProtectedRequest,
  reply: FastifyReply,
) {
  const params = feeComponentIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid fee component ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  await feeComponentsService.deactivateFeeComponent(params.data.id, scope);

  return reply.code(200).send({
    message: "Fee component deactivated successfully",
  });
}

// =====================
// Batch Fee Structure Handlers
// =====================

/**
 * GET /fees/batch-structure
 * List all batch fee structures
 */
export async function listBatchFeeStructures(
  request: ProtectedRequest,
  reply: FastifyReply,
) {
  const sessionId = (request.query as { sessionId?: string }).sessionId;
  const scope = getTenantScopeFromRequest(request);
  const structures = await batchFeeStructureService.getAllBatchFeeStructures(
    sessionId,
    scope,
  );

  return reply.code(200).send({
    data: structures,
  });
}

/**
 * GET /fees/batch-structure/:batchId
 * Get batch fee structure by batch ID
 */
export async function getBatchFeeStructure(
  request: ProtectedRequest,
  reply: FastifyReply,
) {
  const params = batchIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid batch ID",
      details: params.error.flatten(),
    });
  }

  const sessionId = (request.query as { sessionId: string }).sessionId;
  if (!sessionId) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Session ID is required",
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const structure = await batchFeeStructureService.getBatchFeeStructure(
    params.data.batchId,
    sessionId,
    scope,
  );

  if (!structure) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Batch fee structure not found",
    });
  }

  return reply.code(200).send({
    data: structure,
  });
}

/**
 * POST /fees/batch-structure
 * Create or update batch fee structure
 */
export async function createBatchFeeStructure(
  request: ProtectedRequest,
  reply: FastifyReply,
) {
  const body = createBatchFeeStructureSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const structure =
    await batchFeeStructureService.createOrUpdateBatchFeeStructure(
      body.data,
      scope,
    );

  return reply.code(201).send({
    data: structure,
    message: "Batch fee structure saved successfully",
  });
}

/**
 * PATCH /fees/batch-structure/:id
 * Update batch fee structure
 */
export async function updateBatchFeeStructure(
  request: ProtectedRequest,
  reply: FastifyReply,
) {
  const params = batchFeeStructureIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid batch fee structure ID",
      details: params.error.flatten(),
    });
  }

  const body = updateBatchFeeStructureSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const structure = await batchFeeStructureService.updateBatchFeeStructure(
    params.data.id,
    body.data,
    scope,
  );

  return reply.code(200).send({
    data: structure,
    message: "Batch fee structure updated successfully",
  });
}

/**
 * POST /fees/batch-structure/:id/apply
 * Apply batch fee structure to all students in batch
 */
export async function applyBatchFeeStructureToStudents(
  request: ProtectedRequest,
  reply: FastifyReply,
) {
  const params = batchFeeStructureIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid batch fee structure ID",
      details: params.error.flatten(),
    });
  }

  const body = applyToStudentsSchema.safeParse(request.body);
  const overwriteExisting = body.success ? body.data.overwriteExisting : false;

  const scope = getTenantScopeFromRequest(request);
  const result = await batchFeeStructureService.applyToStudents(
    params.data.id,
    overwriteExisting,
    scope,
  );

  return reply.code(200).send({
    data: result,
    message: result.message,
  });
}

// =====================
// Student Fee Structure Handlers
// =====================

/**
 * GET /fees/student-structure/:studentId
 * Get student fee structure
 */
export async function getStudentFeeStructure(
  request: ProtectedRequest,
  reply: FastifyReply,
) {
  const params = studentFeeStructureStudentIdParamSchema.safeParse(
    request.params,
  );
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid student ID",
      details: params.error.flatten(),
    });
  }

  const sessionId = (request.query as { sessionId: string }).sessionId;
  if (!sessionId) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Session ID is required",
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const structure = await studentFeeStructureService.getStudentFeeStructure(
    params.data.studentId,
    sessionId,
    scope,
  );

  return reply.code(200).send({
    data: structure,
  });
}

/**
 * GET /fees/student-structure/id/:id
 * Get student fee structure by ID
 */
export async function getStudentFeeStructureById(
  request: ProtectedRequest,
  reply: FastifyReply,
) {
  const params = studentFeeStructureIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid fee structure ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const structure = await studentFeeStructureService.getStudentFeeStructureById(
    params.data.id,
    scope,
  );

  return reply.code(200).send({
    data: structure,
  });
}

/**
 * POST /fees/student-structure
 * Create custom student fee structure
 */
export async function createStudentFeeStructure(
  request: ProtectedRequest,
  reply: FastifyReply,
) {
  const body = createStudentFeeStructureSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const structure = await studentFeeStructureService.createStudentFeeStructure(
    body.data,
    scope,
  );

  return reply.code(201).send({
    data: structure,
    message: "Student fee structure created successfully",
  });
}

/**
 * PATCH /fees/student-structure/:id
 * Update student fee structure
 */
export async function updateStudentFeeStructure(
  request: ProtectedRequest,
  reply: FastifyReply,
) {
  const params = studentFeeStructureIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid fee structure ID",
      details: params.error.flatten(),
    });
  }

  const body = updateStudentFeeStructureSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const structure = await studentFeeStructureService.updateStudentFeeStructure(
    params.data.id,
    body.data,
    scope,
  );

  return reply.code(200).send({
    data: structure,
    message: "Student fee structure updated successfully",
  });
}

/**
 * GET /fees/student-structure/summary/:studentId
 * Get student fee summary
 */
export async function getStudentFeeSummary(
  request: ProtectedRequest,
  reply: FastifyReply,
) {
  const params = studentFeeStructureStudentIdParamSchema.safeParse(
    request.params,
  );
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid student ID",
      details: params.error.flatten(),
    });
  }

  const sessionId = (request.query as { sessionId?: string }).sessionId;
  const scope = getTenantScopeFromRequest(request);
  const summary = await studentFeeStructureService.getStudentFeeSummary(
    params.data.studentId,
    sessionId,
    scope,
  );

  return reply.code(200).send({
    data: summary,
  });
}
