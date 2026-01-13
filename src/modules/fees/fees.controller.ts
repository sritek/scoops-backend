import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import {
  createFeePlanSchema,
  assignFeeSchema,
  recordPaymentSchema,
  studentIdParamSchema,
} from "./fees.schema.js";
import * as feesService from "./fees.service.js";

/**
 * GET /fees/plans
 * List all fee plans in the branch
 */
export async function listFeePlans(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const plans = await feesService.getFeePlans(scope);

  return reply.code(200).send({
    data: plans,
    count: plans.length,
  });
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
 * Get all pending fees in the branch
 */
export async function getPendingFees(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const fees = await feesService.getPendingFees(scope);

  return reply.code(200).send({
    data: fees,
    count: fees.length,
  });
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

  // Use 200 OK since we're updating an existing fee record
  return reply.code(200).send({
    data: result,
    message: "Payment recorded successfully",
  });
}
