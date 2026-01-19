import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { prisma } from "../../config/database.js";
import { createModuleLogger } from "../../config/logger.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import {
  parsePaginationParams,
  calculateSkip,
  createPaginatedResponse,
} from "../../utils/pagination.js";
import { NOTIFICATION_STATUS, processEvent } from "./notification.service.js";
import type { StoredEvent, EventType } from "../events/event-emitter.js";

const log = createModuleLogger("notifications-controller");

/**
 * List notification logs with pagination and filters
 */
export async function listNotifications(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const { page, limit } = parsePaginationParams(request.query as { page?: string; limit?: string });
  const skip = calculateSkip({ page, limit });
  const { status, templateType } = request.query as { status?: string; templateType?: string };

  // Build where clause
  const where: Record<string, unknown> = {
    branch: {
      orgId: scope.orgId,
      id: scope.branchId,
    },
  };

  if (status) {
    where.status = status;
  }

  if (templateType) {
    where.template = {
      type: templateType,
    };
  }

  const [notifications, total] = await Promise.all([
    prisma.notificationLog.findMany({
      where,
      orderBy: { sentAt: "desc" },
      skip,
      take: limit,
      include: {
        template: {
          select: {
            type: true,
            name: true,
          },
        },
      },
    }),
    prisma.notificationLog.count({ where }),
  ]);

  const response = createPaginatedResponse(notifications, total, { page, limit });

  return reply.send(response);
}

/**
 * Get notification statistics
 */
export async function getNotificationStats(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);

  // Get today's date range
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // Get last 7 days
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);
  last7Days.setHours(0, 0, 0, 0);

  // Get last 30 days
  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);
  last30Days.setHours(0, 0, 0, 0);

  const baseWhere = {
    branch: {
      orgId: scope.orgId,
      id: scope.branchId,
    },
  };

  const [
    todayStats,
    last7DaysStats,
    last30DaysStats,
    byStatus,
    byType,
  ] = await Promise.all([
    // Today's stats
    prisma.notificationLog.groupBy({
      by: ["status"],
      where: {
        ...baseWhere,
        sentAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      _count: true,
    }),
    // Last 7 days
    prisma.notificationLog.groupBy({
      by: ["status"],
      where: {
        ...baseWhere,
        sentAt: {
          gte: last7Days,
        },
      },
      _count: true,
    }),
    // Last 30 days
    prisma.notificationLog.groupBy({
      by: ["status"],
      where: {
        ...baseWhere,
        sentAt: {
          gte: last30Days,
        },
      },
      _count: true,
    }),
    // All time by status
    prisma.notificationLog.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: true,
    }),
    // By template type
    prisma.notificationLog.findMany({
      where: baseWhere,
      select: {
        template: {
          select: { type: true },
        },
      },
    }),
  ]);

  // Format stats
  const formatStats = (stats: { status: string; _count: number }[]) => ({
    total: stats.reduce((sum, s) => sum + s._count, 0),
    sent: stats.find((s) => s.status === NOTIFICATION_STATUS.SENT)?._count || 0,
    failed: stats.find((s) => s.status === NOTIFICATION_STATUS.FAILED)?._count || 0,
    pending: stats.find((s) => s.status === NOTIFICATION_STATUS.PENDING)?._count || 0,
  });

  // Count by type
  const typeCount: Record<string, number> = {};
  for (const n of byType) {
    const type = n.template.type;
    typeCount[type] = (typeCount[type] || 0) + 1;
  }

  return reply.send({
    today: formatStats(todayStats),
    last7Days: formatStats(last7DaysStats),
    last30Days: formatStats(last30DaysStats),
    allTime: formatStats(byStatus),
    byType: typeCount,
  });
}

/**
 * Retry a failed notification
 */
export async function retryNotification(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const { id } = request.params as { id: string };

  // Get the notification log
  const notification = await prisma.notificationLog.findFirst({
    where: {
      id,
      branch: {
        orgId: scope.orgId,
        id: scope.branchId,
      },
    },
    include: {
      template: true,
    },
  });

  if (!notification) {
    return reply.status(404).send({
      error: "Not found",
      message: "Notification not found",
    });
  }

  if (notification.status !== NOTIFICATION_STATUS.FAILED) {
    return reply.status(400).send({
      error: "Bad request",
      message: "Only failed notifications can be retried",
    });
  }

  // Find the original event
  const event = await prisma.event.findFirst({
    where: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      payload: {
        contains: notification.entityId || "",
      },
    },
  });

  if (!event) {
    return reply.status(404).send({
      error: "Not found",
      message: "Original event not found",
    });
  }

  // Reset notification status to pending
  await prisma.notificationLog.update({
    where: { id },
    data: {
      status: NOTIFICATION_STATUS.PENDING,
      errorMessage: null,
    },
  });

  // Re-process the event
  try {
    const storedEvent: StoredEvent = {
      id: event.id,
      type: event.type as EventType,
      orgId: event.orgId,
      branchId: event.branchId,
      payload: JSON.parse(event.payload),
      status: "pending",
      createdAt: event.createdAt,
      processedAt: event.processedAt,
    };

    await processEvent(storedEvent);

    log.info({ notificationId: id }, "Notification retried");

    return reply.send({
      success: true,
      message: "Notification queued for retry",
    });
  } catch (error) {
    log.error({ error, notificationId: id }, "Failed to retry notification");

    return reply.status(500).send({
      error: "Server error",
      message: "Failed to retry notification",
    });
  }
}

/**
 * Get a single notification details
 */
export async function getNotification(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const { id } = request.params as { id: string };

  const notification = await prisma.notificationLog.findFirst({
    where: {
      id,
      branch: {
        orgId: scope.orgId,
        id: scope.branchId,
      },
    },
    include: {
      template: {
        select: {
          type: true,
          name: true,
          content: true,
        },
      },
    },
  });

  if (!notification) {
    return reply.status(404).send({
      error: "Not found",
      message: "Notification not found",
    });
  }

  return reply.send(notification);
}
