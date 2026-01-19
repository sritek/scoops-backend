/**
 * Complaints Controller
 */

import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import { parsePaginationParams } from "../../utils/pagination.js";
import {
  createComplaintSchema,
  updateComplaintSchema,
  addCommentSchema,
  complaintIdParamSchema,
  listComplaintsQuerySchema,
} from "./complaints.schema.js";
import * as complaintsService from "./complaints.service.js";

export async function createComplaint(request: ProtectedRequest, reply: FastifyReply) {
  const scope = getTenantScopeFromRequest(request);
  const body = createComplaintSchema.parse(request.body);

  const complaint = await complaintsService.createComplaint(
    body,
    request.userContext.userId,
    scope
  );

  return reply.code(201).send({ data: complaint });
}

export async function listComplaints(request: ProtectedRequest, reply: FastifyReply) {
  const scope = getTenantScopeFromRequest(request);
  const query = listComplaintsQuerySchema.parse(request.query);
  const pagination = parsePaginationParams({
    page: query.page?.toString(),
    limit: query.limit?.toString(),
  });

  const result = await complaintsService.getComplaints(scope, pagination, {
    status: query.status,
    priority: query.priority,
    category: query.category,
    assignedToId: query.assignedToId,
  });

  return reply.code(200).send(result);
}

export async function getComplaint(request: ProtectedRequest, reply: FastifyReply) {
  const scope = getTenantScopeFromRequest(request);
  const { id } = complaintIdParamSchema.parse(request.params);

  const complaint = await complaintsService.getComplaintById(id, scope);

  return reply.code(200).send({ data: complaint });
}

export async function updateComplaint(request: ProtectedRequest, reply: FastifyReply) {
  const scope = getTenantScopeFromRequest(request);
  const { id } = complaintIdParamSchema.parse(request.params);
  const body = updateComplaintSchema.parse(request.body);

  const complaint = await complaintsService.updateComplaint(id, body, scope);

  return reply.code(200).send({ data: complaint });
}

export async function addComment(request: ProtectedRequest, reply: FastifyReply) {
  const scope = getTenantScopeFromRequest(request);
  const { id } = complaintIdParamSchema.parse(request.params);
  const body = addCommentSchema.parse(request.body);

  const comment = await complaintsService.addComment(
    id,
    body,
    request.userContext.userId,
    scope
  );

  return reply.code(201).send({ data: comment });
}

export async function getStats(request: ProtectedRequest, reply: FastifyReply) {
  const scope = getTenantScopeFromRequest(request);
  const stats = await complaintsService.getComplaintStats(scope);
  return reply.code(200).send({ data: stats });
}
