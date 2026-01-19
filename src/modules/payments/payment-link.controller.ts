/**
 * Payment Link Controller
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import { parsePaginationParams } from "../../utils/pagination.js";
import {
  createPaymentLinkSchema,
  paymentLinkIdParamSchema,
  shortCodeParamSchema,
  listPaymentLinksQuerySchema,
} from "./payment-link.schema.js";
import * as paymentLinkService from "./payment-link.service.js";

/**
 * POST /payment-links
 * Create a new payment link
 */
export async function createPaymentLink(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const body = createPaymentLinkSchema.parse(request.body);

  const paymentLink = await paymentLinkService.createPaymentLink(
    body,
    request.userContext.userId,
    scope
  );

  return reply.code(201).send({
    data: paymentLink,
  });
}

/**
 * GET /payment-links
 * List payment links
 */
export async function listPaymentLinks(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const query = listPaymentLinksQuerySchema.parse(request.query);
  const pagination = parsePaginationParams({
    page: query.page?.toString(),
    limit: query.limit?.toString(),
  });

  const result = await paymentLinkService.getPaymentLinks(scope, pagination, {
    status: query.status,
    studentId: query.studentId,
    search: query.search,
  });

  return reply.code(200).send(result);
}

/**
 * GET /payment-links/:id
 * Get payment link by ID
 */
export async function getPaymentLink(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const { id } = paymentLinkIdParamSchema.parse(request.params);

  const paymentLink = await paymentLinkService.getPaymentLinkById(id, scope);

  return reply.code(200).send({
    data: paymentLink,
  });
}

/**
 * DELETE /payment-links/:id
 * Cancel a payment link
 */
export async function cancelPaymentLink(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const { id } = paymentLinkIdParamSchema.parse(request.params);

  await paymentLinkService.cancelPaymentLink(id, scope);

  return reply.code(200).send({
    message: "Payment link cancelled",
  });
}

/**
 * GET /pay/:shortCode (Public)
 * Get payment link details by short code
 */
export async function getPublicPaymentLink(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { shortCode } = shortCodeParamSchema.parse(request.params);

  const paymentLink = await paymentLinkService.getPaymentLinkByShortCode(shortCode);

  return reply.code(200).send({
    data: paymentLink,
  });
}
