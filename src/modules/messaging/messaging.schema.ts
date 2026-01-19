/**
 * Messaging Zod Schemas
 */

import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination.js";

/**
 * Create conversation schema
 */
export const createConversationSchema = z.object({
  type: z.enum(["direct", "broadcast", "announcement"]),
  title: z.string().max(200).optional(),
  batchId: z.string().uuid().optional(),
  participantUserIds: z.array(z.string().uuid()).optional(),
  participantParentIds: z.array(z.string().uuid()).optional(),
  initialMessage: z.string().min(1).max(5000),
});

/**
 * Send message schema
 */
export const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  attachmentUrl: z.string().url().optional(),
});

/**
 * Broadcast schema
 */
export const broadcastSchema = z.object({
  batchId: z.string().uuid(),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
});

/**
 * Conversation ID param
 */
export const conversationIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * List conversations query
 */
export const listConversationsQuerySchema = paginationQuerySchema;

// Types
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type BroadcastInput = z.infer<typeof broadcastSchema>;
export type ConversationIdParam = z.infer<typeof conversationIdParamSchema>;
