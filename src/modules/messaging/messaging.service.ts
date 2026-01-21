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

  // For direct messages, check if conversation already exists with this parent
  if (input.type === "direct" && input.participantParentIds?.length === 1) {
    const parentId = input.participantParentIds[0];

    const existingConversation = await prisma.conversation.findFirst({
      where: {
        orgId: scope.orgId,
        branchId: scope.branchId,
        type: "direct",
        participants: {
          some: { parentId },
        },
        AND: {
          participants: {
            some: { userId },
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
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        batch: { select: { name: true } },
      },
    });

    if (existingConversation) {
      // Send the new message to existing conversation
      if (input.initialMessage) {
        await prisma.message.create({
          data: {
            conversationId: existingConversation.id,
            senderUserId: userId,
            content: input.initialMessage,
          },
        });
        // Update conversation's updatedAt
        await prisma.conversation.update({
          where: { id: existingConversation.id },
          data: { updatedAt: new Date() },
        });
      }
      return formatConversation(existingConversation, userId);
    }
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
  // Check if broadcast conversation already exists for this batch
  const existingBroadcast = await prisma.conversation.findFirst({
    where: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      type: "broadcast",
      batchId,
    },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { participants: true } },
    },
  });

  if (existingBroadcast) {
    // Send message to existing broadcast conversation
    await prisma.message.create({
      data: {
        conversationId: existingBroadcast.id,
        senderUserId: userId,
        content: message,
      },
    });
    // Update conversation title and updatedAt
    await prisma.conversation.update({
      where: { id: existingBroadcast.id },
      data: {
        title, // Update title to latest
        updatedAt: new Date(),
      },
    });

    return {
      id: existingBroadcast.id,
      title,
      participantCount: existingBroadcast._count.participants,
      message: "Message added to existing broadcast",
    };
  }

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

// ============================================================================
// Parent-specific messaging functions
// ============================================================================

/**
 * Get conversations for a parent
 */
export async function getParentConversations(
  parentId: string,
  pagination: PaginationParams
) {
  const where = {
    participants: {
      some: { parentId },
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
    conversations.map((c) => formatParentConversation(c, parentId)),
    total,
    pagination
  );
}

/**
 * Get conversation by ID for parent
 */
export async function getParentConversation(id: string, parentId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id,
      participants: {
        some: { parentId },
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
      parentId,
    },
    data: {
      lastReadAt: new Date(),
    },
  });

  return {
    ...formatParentConversation(conversation, parentId),
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
      isOwnMessage: m.senderParentId === parentId,
      isFromStaff: !!m.senderUserId,
    })),
  };
}

/**
 * Send a message as parent
 */
export async function sendParentMessage(
  conversationId: string,
  input: SendMessageInput,
  parentId: string
) {
  // Verify parent is participant
  const participation = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId,
      parentId,
    },
  });

  if (!participation) {
    throw new ForbiddenError("You are not a participant of this conversation");
  }

  // Create message
  const message = await prisma.message.create({
    data: {
      conversationId,
      senderParentId: parentId,
      content: input.content,
      attachmentUrl: input.attachmentUrl,
    },
    include: {
      senderParent: { select: { firstName: true, lastName: true } },
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
    senderName: message.senderParent
      ? `${message.senderParent.firstName} ${message.senderParent.lastName}`
      : "Unknown",
    isOwnMessage: true,
    isFromStaff: false,
  };
}

/**
 * Get unread count for parent
 */
export async function getParentUnreadCount(parentId: string) {
  const participations = await prisma.conversationParticipant.findMany({
    where: {
      parentId,
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
 * Get announcements for parent
 * Returns broadcast and announcement type conversations for parent's children's batches
 */
export async function getParentAnnouncements(
  parentId: string,
  pagination: PaginationParams
) {
  // First get all batch IDs for parent's children
  const children = await prisma.studentParent.findMany({
    where: { parentId },
    include: {
      student: {
        select: {
          batchId: true,
        },
      },
    },
  });

  const batchIds = children
    .map((c) => c.student.batchId)
    .filter((id): id is string => id !== null);

  // Get announcements where:
  // 1. type is 'broadcast' or 'announcement'
  // 2. Either parent is a participant OR batchId matches one of parent's children's batches
  const where = {
    OR: [
      // Parent is explicitly a participant
      {
        type: { in: ["broadcast", "announcement"] as any },
        participants: {
          some: { parentId },
        },
      },
      // Batch broadcast for parent's children's batches
      {
        type: "broadcast" as any,
        batchId: { in: batchIds },
      },
    ],
  };

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: {
        participants: {
          include: {
            user: { select: { firstName: true, lastName: true } },
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
      orderBy: { createdAt: "desc" },
      skip: calculateSkip(pagination),
      take: pagination.limit,
    }),
    prisma.conversation.count({ where }),
  ]);

  // Check if parent has read each announcement
  const participations = await prisma.conversationParticipant.findMany({
    where: {
      parentId,
      conversationId: { in: conversations.map((c) => c.id) },
    },
    select: {
      conversationId: true,
      lastReadAt: true,
    },
  });

  const participationMap = new Map(
    participations.map((p) => [p.conversationId, p.lastReadAt])
  );

  const formattedAnnouncements = conversations.map((c) => {
    const lastMessage = c.messages?.[0];
    const lastReadAt = participationMap.get(c.id);
    const isRead = lastReadAt
      ? !lastMessage || new Date(lastReadAt) >= new Date(lastMessage.createdAt)
      : false;

    const senderName = c.participants.find((p) => p.userId)?.user
      ? `${c.participants.find((p) => p.userId)?.user?.firstName} ${c.participants.find((p) => p.userId)?.user?.lastName}`
      : "Staff";

    return {
      id: c.id,
      type: c.type,
      title: c.title || "Announcement",
      batchName: c.batch?.name ?? null,
      isSchoolWide: !c.batchId,
      senderName,
      content: lastMessage?.content ?? "",
      createdAt: c.createdAt,
      isRead,
      messageCount: c._count?.messages || 0,
    };
  });

  return createPaginatedResponse(formattedAnnouncements, total, pagination);
}

/**
 * Find or create a direct conversation between a parent and staff member
 */
export async function findOrCreateParentStaffConversation(
  parentId: string,
  staffUserId: string,
  initialMessage?: string
): Promise<{ conversation: any; created: boolean }> {
  // 1. Check if direct conversation already exists between this parent and staff
  const existing = await prisma.conversation.findFirst({
    where: {
      type: "direct",
      participants: {
        some: { parentId },
      },
      AND: {
        participants: {
          some: { userId: staffUserId },
        },
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
      _count: { select: { messages: true } },
    },
  });

  if (existing) {
    // If initial message provided, add it to the existing conversation
    if (initialMessage) {
      await prisma.message.create({
        data: {
          conversationId: existing.id,
          senderParentId: parentId,
          content: initialMessage,
        },
      });
      await prisma.conversation.update({
        where: { id: existing.id },
        data: { updatedAt: new Date() },
      });
    }

    // Mark as read
    await prisma.conversationParticipant.updateMany({
      where: { conversationId: existing.id, parentId },
      data: { lastReadAt: new Date() },
    });

    return {
      conversation: {
        ...formatParentConversation(existing, parentId),
        messages: existing.messages.map((m) => ({
          id: m.id,
          content: m.content,
          attachmentUrl: m.attachmentUrl,
          createdAt: m.createdAt,
          senderName: m.senderUser
            ? `${m.senderUser.firstName} ${m.senderUser.lastName}`
            : m.senderParent
            ? `${m.senderParent.firstName} ${m.senderParent.lastName}`
            : "Unknown",
          isOwnMessage: m.senderParentId === parentId,
          isFromStaff: !!m.senderUserId,
        })),
      },
      created: false,
    };
  }

  // 2. Get staff user details for title and org/branch info
  const staffUser = await prisma.user.findUnique({
    where: { id: staffUserId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      orgId: true,
      branchId: true,
    },
  });

  if (!staffUser) {
    throw new NotFoundError("Staff user");
  }

  // 3. Create new conversation
  const conversation = await prisma.conversation.create({
    data: {
      orgId: staffUser.orgId,
      branchId: staffUser.branchId!,
      type: "direct",
      title: `Chat with ${staffUser.firstName} ${staffUser.lastName}`,
      createdById: staffUserId,
      participants: {
        create: [{ parentId }, { userId: staffUserId }],
      },
      messages: initialMessage
        ? {
            create: {
              senderParentId: parentId,
              content: initialMessage,
            },
          }
        : undefined,
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
      _count: { select: { messages: true } },
    },
  });

  return {
    conversation: {
      ...formatParentConversation(conversation, parentId),
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
        isOwnMessage: m.senderParentId === parentId,
        isFromStaff: !!m.senderUserId,
      })),
    },
    created: true,
  };
}

/**
 * Format conversation for parent response
 */
function formatParentConversation(conversation: any, currentParentId: string) {
  const lastMessage = conversation.messages?.[0];
  const staffParticipants = conversation.participants
    .filter((p: any) => p.userId)
    .map((p: any) => ({
      name: p.user ? `${p.user.firstName} ${p.user.lastName}` : "Staff",
    }));

  return {
    id: conversation.id,
    type: conversation.type,
    title: conversation.title || (staffParticipants[0]?.name ?? "Conversation"),
    batchName: conversation.batch?.name,
    staffParticipants,
    lastMessage: lastMessage
      ? {
          content: lastMessage.content.substring(0, 50) + (lastMessage.content.length > 50 ? "..." : ""),
          createdAt: lastMessage.createdAt,
          isFromStaff: !!lastMessage.senderUserId,
        }
      : null,
    messageCount: conversation._count?.messages || 0,
    updatedAt: conversation.updatedAt,
    createdAt: conversation.createdAt,
  };
}
