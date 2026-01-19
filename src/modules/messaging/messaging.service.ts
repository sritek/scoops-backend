/**
 * Messaging Service
 *
 * Handles conversations and messages between users and parents
 */

import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import { NotFoundError, BadRequestError, ForbiddenError } from "../../utils/error-handler.js";
import {
  type PaginationParams,
  createPaginatedResponse,
  calculateSkip,
} from "../../utils/pagination.js";
import type { MessageType } from "@prisma/client";

/**
 * Create conversation input
 */
export interface CreateConversationInput {
  type: MessageType;
  title?: string;
  batchId?: string;
  participantUserIds?: string[];
  participantParentIds?: string[];
  initialMessage: string;
}

/**
 * Send message input
 */
export interface SendMessageInput {
  content: string;
  attachmentUrl?: string;
}

/**
 * Create a new conversation
 */
export async function createConversation(
  input: CreateConversationInput,
  userId: string,
  scope: TenantScope
) {
  // Validate type-specific requirements
  if (input.type === "broadcast" && !input.batchId) {
    throw new BadRequestError("Batch ID required for broadcast messages");
  }

  if (input.type === "direct" && (!input.participantParentIds || input.participantParentIds.length !== 1)) {
    throw new BadRequestError("Direct messages require exactly one parent participant");
  }

  // Create conversation with participants
  const conversation = await prisma.conversation.create({
    data: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      type: input.type,
      title: input.title,
      batchId: input.batchId,
      createdById: userId,
      participants: {
        create: [
          // Add creator as participant
          { userId },
          // Add user participants
          ...(input.participantUserIds || []).map((id) => ({ userId: id })),
          // Add parent participants
          ...(input.participantParentIds || []).map((id) => ({ parentId: id })),
        ],
      },
      messages: {
        create: {
          senderUserId: userId,
          content: input.initialMessage,
        },
      },
    },
    include: {
      participants: {
        include: {
          user: { select: { firstName: true, lastName: true } },
          parent: { select: { firstName: true, lastName: true } },
        },
      },
      messages: true,
      batch: { select: { name: true } },
    },
  });

  return formatConversation(conversation, userId);
}

/**
 * Get conversations for a user
 */
export async function getConversations(
  userId: string,
  scope: TenantScope,
  pagination: PaginationParams
) {
  const where = {
    orgId: scope.orgId,
    branchId: scope.branchId,
    participants: {
      some: { userId },
    },
  };

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: {
        participants: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            parent: { select: { firstName: true, lastName: true } },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        batch: { select: { name: true } },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: calculateSkip(pagination),
      take: pagination.limit,
    }),
    prisma.conversation.count({ where }),
  ]);

  return createPaginatedResponse(
    conversations.map((c) => formatConversation(c, userId)),
    total,
    pagination
  );
}

/**
 * Get conversation by ID with messages
 */
export async function getConversation(
  id: string,
  userId: string,
  scope: TenantScope
) {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
      participants: {
        some: { userId },
      },
    },
    include: {
      participants: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          parent: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      messages: {
        include: {
          senderUser: { select: { firstName: true, lastName: true } },
          senderParent: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      batch: { select: { name: true } },
    },
  });

  if (!conversation) {
    throw new NotFoundError("Conversation");
  }

  // Mark as read
  await prisma.conversationParticipant.updateMany({
    where: {
      conversationId: id,
      userId,
    },
    data: {
      lastReadAt: new Date(),
    },
  });

  return {
    ...formatConversation(conversation, userId),
    messages: conversation.messages.map((m) => ({
      id: m.id,
      content: m.content,
      attachmentUrl: m.attachmentUrl,
      createdAt: m.createdAt,
      senderName: m.senderUser
        ? `${m.senderUser.firstName} ${m.senderUser.lastName}`
        : m.senderParent
        ? `${m.senderParent.firstName} ${m.senderParent.lastName}`
        : "Unknown",
      isOwnMessage: m.senderUserId === userId,
    })),
  };
}

/**
 * Send a message in a conversation
 */
export async function sendMessage(
  conversationId: string,
  input: SendMessageInput,
  userId: string,
  scope: TenantScope
) {
  // Verify user is participant
  const participation = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId,
      userId,
      conversation: {
        orgId: scope.orgId,
        branchId: scope.branchId,
      },
    },
  });

  if (!participation) {
    throw new ForbiddenError("You are not a participant of this conversation");
  }

  // Create message
  const message = await prisma.message.create({
    data: {
      conversationId,
      senderUserId: userId,
      content: input.content,
      attachmentUrl: input.attachmentUrl,
    },
    include: {
      senderUser: { select: { firstName: true, lastName: true } },
    },
  });

  // Update conversation timestamp
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  return {
    id: message.id,
    content: message.content,
    attachmentUrl: message.attachmentUrl,
    createdAt: message.createdAt,
    senderName: message.senderUser
      ? `${message.senderUser.firstName} ${message.senderUser.lastName}`
      : "Unknown",
    isOwnMessage: true,
  };
}

/**
 * Get unread message count
 */
export async function getUnreadCount(userId: string, scope: TenantScope) {
  const participations = await prisma.conversationParticipant.findMany({
    where: {
      userId,
      conversation: {
        orgId: scope.orgId,
        branchId: scope.branchId,
      },
    },
    include: {
      conversation: {
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  let unreadCount = 0;
  for (const p of participations) {
    const lastMessage = p.conversation.messages[0];
    if (lastMessage && (!p.lastReadAt || lastMessage.createdAt > p.lastReadAt)) {
      unreadCount++;
    }
  }

  return { unreadCount };
}

/**
 * Create broadcast to batch
 */
export async function createBroadcast(
  batchId: string,
  title: string,
  message: string,
  userId: string,
  scope: TenantScope
) {
  // Verify batch exists
  const batch = await prisma.batch.findFirst({
    where: {
      id: batchId,
      branchId: scope.branchId,
    },
    include: {
      students: {
        include: {
          studentParents: {
            include: {
              parent: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!batch) {
    throw new NotFoundError("Batch");
  }

  // Get all parent IDs for the batch
  const parentIds = new Set<string>();
  for (const student of batch.students) {
    for (const sp of student.studentParents) {
      parentIds.add(sp.parent.id);
    }
  }

  // Create broadcast conversation
  const conversation = await prisma.conversation.create({
    data: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      type: "broadcast",
      title,
      batchId,
      createdById: userId,
      participants: {
        create: [
          { userId },
          ...Array.from(parentIds).map((id) => ({ parentId: id })),
        ],
      },
      messages: {
        create: {
          senderUserId: userId,
          content: message,
        },
      },
    },
    include: {
      _count: { select: { participants: true } },
    },
  });

  return {
    id: conversation.id,
    title,
    participantCount: conversation._count.participants,
    message: "Broadcast sent successfully",
  };
}

/**
 * Format conversation for response
 */
function formatConversation(conversation: any, currentUserId: string) {
  const lastMessage = conversation.messages?.[0];
  const otherParticipants = conversation.participants
    .filter((p: any) => p.userId !== currentUserId)
    .map((p: any) => ({
      type: p.userId ? "user" : "parent",
      name: p.user
        ? `${p.user.firstName} ${p.user.lastName}`
        : p.parent
        ? `${p.parent.firstName} ${p.parent.lastName}`
        : "Unknown",
    }));

  return {
    id: conversation.id,
    type: conversation.type,
    title: conversation.title || (otherParticipants[0]?.name ?? "Conversation"),
    batchName: conversation.batch?.name,
    participants: otherParticipants,
    lastMessage: lastMessage
      ? {
          content: lastMessage.content.substring(0, 50) + (lastMessage.content.length > 50 ? "..." : ""),
          createdAt: lastMessage.createdAt,
        }
      : null,
    messageCount: conversation._count?.messages || 0,
    updatedAt: conversation.updatedAt,
    createdAt: conversation.createdAt,
  };
}
