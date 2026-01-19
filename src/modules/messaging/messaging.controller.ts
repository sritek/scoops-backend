/**
 * Messaging Controller
 */

import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import { parsePaginationParams } from "../../utils/pagination.js";
import {
  createConversationSchema,
  sendMessageSchema,
  broadcastSchema,
  conversationIdParamSchema,
  listConversationsQuerySchema,
} from "./messaging.schema.js";
import * as messagingService from "./messaging.service.js";

/**
 * POST /messages/conversations
 * Create a new conversation
 */
export async function createConversation(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const body = createConversationSchema.parse(request.body);

  const conversation = await messagingService.createConversation(
    body,
    request.userContext.userId,
    scope
  );

  return reply.code(201).send({ data: conversation });
}

/**
 * GET /messages/conversations
 * List conversations
 */
export async function listConversations(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const query = listConversationsQuerySchema.parse(request.query);
  const pagination = parsePaginationParams({
    page: query.page?.toString(),
    limit: query.limit?.toString(),
  });

  const result = await messagingService.getConversations(
    request.userContext.userId,
    scope,
    pagination
  );

  return reply.code(200).send(result);
}

/**
 * GET /messages/conversations/:id
 * Get conversation with messages
 */
export async function getConversation(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const { id } = conversationIdParamSchema.parse(request.params);

  const conversation = await messagingService.getConversation(
    id,
    request.userContext.userId,
    scope
  );

  return reply.code(200).send({ data: conversation });
}

/**
 * POST /messages/conversations/:id/messages
 * Send a message
 */
export async function sendMessage(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const { id } = conversationIdParamSchema.parse(request.params);
  const body = sendMessageSchema.parse(request.body);

  const message = await messagingService.sendMessage(
    id,
    body,
    request.userContext.userId,
    scope
  );

  return reply.code(201).send({ data: message });
}

/**
 * GET /messages/unread
 * Get unread message count
 */
export async function getUnreadCount(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);

  const result = await messagingService.getUnreadCount(
    request.userContext.userId,
    scope
  );

  return reply.code(200).send({ data: result });
}

/**
 * POST /messages/broadcast
 * Create broadcast to batch
 */
export async function createBroadcast(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const body = broadcastSchema.parse(request.body);

  const result = await messagingService.createBroadcast(
    body.batchId,
    body.title,
    body.message,
    request.userContext.userId,
    scope
  );

  return reply.code(201).send({ data: result });
}
