import { prisma } from "../../config/database.js";
import type {
  StoredEvent} from "../events/index.js";
import {
  EVENT_TYPES,
  markEventProcessed,
  markEventFailed,
} from "../events/index.js";
import {
  sendWhatsAppMessage,
  normalizePhone,
  isValidIndianPhone,
} from "./whatsapp.provider.js";

/**
 * Helper to format full name
 */
function formatFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/**
 * Template types matching event types
 */
const TEMPLATE_TYPE_MAP: Record<string, string> = {
  [EVENT_TYPES.STUDENT_ABSENT]: "absent",
  [EVENT_TYPES.FEE_CREATED]: "fee_due",
  [EVENT_TYPES.FEE_PAID]: "fee_paid",
};

/**
 * Notification status
 */
export const NOTIFICATION_STATUS = {
  PENDING: "pending",
  SENT: "sent",
  FAILED: "failed",
} as const;

/**
 * Process a single event and send notification if needed
 */
export async function processEvent(event: StoredEvent): Promise<void> {
  const templateType = TEMPLATE_TYPE_MAP[event.type];

  // Not all events trigger notifications
  if (!templateType) {
    await markEventProcessed(event.id, event.orgId, event.branchId);
    return;
  }

  try {
    // Get the template - scoped by org
    const template = await prisma.messageTemplate.findFirst({
      where: {
        orgId: event.orgId,
        type: templateType,
        isActive: true,
      },
    });

    if (!template) {
      console.warn(`No active template found for type: ${templateType}`);
      await markEventProcessed(event.id, event.orgId, event.branchId);
      return;
    }

    // Get recipient phone based on event type - with tenant scope
    const recipientPhone = await getRecipientPhone(event);

    if (!recipientPhone) {
      console.warn(`No recipient phone found for event: ${event.id}`);
      await markEventProcessed(event.id, event.orgId, event.branchId);
      return;
    }

    // Validate phone number
    if (!isValidIndianPhone(recipientPhone)) {
      console.warn(`Invalid phone number for event: ${event.id}, phone: ${recipientPhone}`);
      await markEventFailed(event.id, event.orgId, event.branchId, "Invalid phone number");
      return;
    }

    // Check for duplicate (same recipient, same template, same day)
    const isDuplicate = await checkDuplicateNotification(
      event.orgId,
      event.branchId,
      recipientPhone,
      template.id,
      event.payload.entityId
    );

    if (isDuplicate) {
      console.log(`Duplicate notification prevented for: ${recipientPhone}`);
      await markEventProcessed(event.id, event.orgId, event.branchId);
      return;
    }

    // Build message params - with tenant scope
    const messageParams = await buildMessageParams(event);

    // Send notification
    const result = await sendWhatsAppMessage({
      to: normalizePhone(recipientPhone),
      templateName: templateType,
      templateParams: messageParams,
    });

    // Log the notification
    await prisma.notificationLog.create({
      data: {
        orgId: event.orgId,
        branchId: event.branchId,
        recipientPhone: normalizePhone(recipientPhone),
        templateId: template.id,
        status: result.success ? NOTIFICATION_STATUS.SENT : NOTIFICATION_STATUS.FAILED,
        providerMessageId: result.messageId,
        errorMessage: result.error,
        sentAt: new Date(),
        // Store entity reference for duplicate check
        entityType: event.payload.entityType,
        entityId: event.payload.entityId,
      },
    });

    if (result.success) {
      await markEventProcessed(event.id, event.orgId, event.branchId);
      console.log(`Notification sent for event: ${event.id}`);
    } else {
      await markEventFailed(event.id, event.orgId, event.branchId, result.error || "Unknown error");
      console.error(`Notification failed for event: ${event.id}`, result.error);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Error processing event: ${event.id}`, error);
    
    // Wrap markEventFailed in try/catch to prevent double-failure
    try {
      await markEventFailed(event.id, event.orgId, event.branchId, errorMessage);
    } catch (markError) {
      console.error(`Failed to mark event ${event.id} as failed:`, markError);
    }
  }
}

/**
 * Get recipient phone number based on event type - WITH TENANT SCOPING
 */
async function getRecipientPhone(event: StoredEvent): Promise<string | null> {
  const { entityId, data } = event.payload;

  switch (event.type) {
    case EVENT_TYPES.STUDENT_ABSENT: {
      // Get parent phone for student - scoped by tenant
      const studentId = entityId;
      const studentParent = await prisma.studentParent.findFirst({
        where: {
          studentId,
          student: {
            orgId: event.orgId,
            branchId: event.branchId,
          },
        },
        include: {
          parent: {
            select: { phone: true },
          },
        },
      });
      return studentParent?.parent.phone || null;
    }

    case EVENT_TYPES.FEE_CREATED:
    case EVENT_TYPES.FEE_PAID: {
      // Get parent phone for student fee - scoped by tenant
      const studentId = data.studentId as string;
      if (!studentId) return null;

      const studentParent = await prisma.studentParent.findFirst({
        where: {
          studentId,
          student: {
            orgId: event.orgId,
            branchId: event.branchId,
          },
        },
        include: {
          parent: {
            select: { phone: true },
          },
        },
      });
      return studentParent?.parent.phone || null;
    }

    default:
      return null;
  }
}

/**
 * Check if a duplicate notification was already sent today
 */
async function checkDuplicateNotification(
  orgId: string,
  branchId: string,
  recipientPhone: string,
  templateId: string,
  entityId: string
): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const existing = await prisma.notificationLog.findFirst({
    where: {
      orgId,
      branchId,
      recipientPhone: normalizePhone(recipientPhone),
      templateId,
      entityId,
      status: NOTIFICATION_STATUS.SENT,
      sentAt: {
        gte: today,
        lt: tomorrow,
      },
    },
  });

  return existing !== null;
}

/**
 * Build message parameters from event data - WITH TENANT SCOPING
 */
async function buildMessageParams(
  event: StoredEvent
): Promise<Record<string, string>> {
  const { data, entityId } = event.payload;

  switch (event.type) {
    case EVENT_TYPES.STUDENT_ABSENT: {
      const student = await prisma.student.findFirst({
        where: {
          id: entityId,
          orgId: event.orgId,
          branchId: event.branchId,
        },
        select: { firstName: true, lastName: true },
      });
      return {
        studentName: student ? formatFullName(student.firstName, student.lastName) : "Student",
        date: (data.date as string) || new Date().toISOString().split("T")[0],
      };
    }

    case EVENT_TYPES.FEE_CREATED: {
      const studentId = data.studentId as string;
      const student = await prisma.student.findFirst({
        where: {
          id: studentId,
          orgId: event.orgId,
          branchId: event.branchId,
        },
        select: { firstName: true, lastName: true },
      });
      return {
        studentName: student ? formatFullName(student.firstName, student.lastName) : "Student",
        amount: String(Number(data.totalAmount) || 0),
        dueDate: (data.dueDate as string) || "",
      };
    }

    case EVENT_TYPES.FEE_PAID: {
      const studentId = data.studentId as string;
      const student = await prisma.student.findFirst({
        where: {
          id: studentId,
          orgId: event.orgId,
          branchId: event.branchId,
        },
        select: { firstName: true, lastName: true },
      });
      return {
        studentName: student ? formatFullName(student.firstName, student.lastName) : "Student",
        amount: String(Number(data.amount) || 0),
        paymentMode: (data.paymentMode as string) || "cash",
      };
    }

    default:
      return {};
  }
}

/**
 * Process multiple events in batch
 */
export async function processEvents(events: StoredEvent[]): Promise<{
  processed: number;
  failed: number;
}> {
  let processed = 0;
  let failed = 0;

  for (const event of events) {
    try {
      await processEvent(event);
      processed++;
    } catch (error) {
      failed++;
      console.error(`Failed to process event ${event.id}:`, error);
    }
  }

  return { processed, failed };
}

/**
 * Get notification logs for a branch - TENANT SCOPED
 */
export async function getNotificationLogs(
  orgId: string,
  branchId: string,
  limit: number = 50
) {
  return prisma.notificationLog.findMany({
    where: {
      orgId,
      branchId,
    },
    include: {
      template: {
        select: {
          type: true,
          content: true,
        },
      },
    },
    orderBy: {
      sentAt: "desc",
    },
    take: limit,
  });
}

/**
 * Get failed notifications for retry - TENANT SCOPED
 */
export async function getFailedNotifications(
  orgId: string,
  branchId: string,
  limit: number = 50
) {
  return prisma.notificationLog.findMany({
    where: {
      orgId,
      branchId,
      status: NOTIFICATION_STATUS.FAILED,
    },
    orderBy: {
      sentAt: "desc",
    },
    take: limit,
  });
}

/**
 * Retry a failed notification manually - TENANT SCOPED
 */
export async function retryNotification(
  notificationId: string,
  orgId: string,
  branchId: string
): Promise<boolean> {
  const notification = await prisma.notificationLog.findFirst({
    where: {
      id: notificationId,
      orgId,
      branchId,
      status: NOTIFICATION_STATUS.FAILED,
    },
    include: {
      template: true,
    },
  });

  if (!notification || !notification.template) {
    return false;
  }

  // Rebuild params from stored entity reference
  const messageParams = await rebuildMessageParams(
    notification.entityType,
    notification.entityId,
    orgId,
    branchId
  );

  // Resend
  const result = await sendWhatsAppMessage({
    to: notification.recipientPhone,
    templateName: notification.template.type,
    templateParams: messageParams,
  });

  // Update status
  await prisma.notificationLog.update({
    where: { id: notificationId },
    data: {
      status: result.success ? NOTIFICATION_STATUS.SENT : NOTIFICATION_STATUS.FAILED,
      providerMessageId: result.messageId,
      errorMessage: result.error,
      sentAt: new Date(),
    },
  });

  return result.success;
}

/**
 * Rebuild message params for retry from stored entity reference
 */
async function rebuildMessageParams(
  entityType: string | null,
  entityId: string | null,
  orgId: string,
  branchId: string
): Promise<Record<string, string>> {
  if (!entityType || !entityId) {
    return {};
  }

  switch (entityType) {
    case "student": {
      const student = await prisma.student.findFirst({
        where: { id: entityId, orgId, branchId },
        select: { firstName: true, lastName: true },
      });
      return {
        studentName: student ? formatFullName(student.firstName, student.lastName) : "Student",
        date: new Date().toISOString().split("T")[0],
      };
    }

    case "student_fee": {
      const fee = await prisma.studentFee.findFirst({
        where: {
          id: entityId,
          student: { orgId, branchId },
        },
        include: {
          student: { select: { firstName: true, lastName: true } },
        },
      });
      return {
        studentName: fee ? formatFullName(fee.student.firstName, fee.student.lastName) : "Student",
        amount: String(fee?.totalAmount || 0),
        dueDate: fee?.dueDate?.toISOString().split("T")[0] || "",
      };
    }

    case "fee_payment": {
      const payment = await prisma.feePayment.findFirst({
        where: {
          id: entityId,
          studentFee: {
            student: { orgId, branchId },
          },
        },
        include: {
          studentFee: {
            include: {
              student: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });
      return {
        studentName: payment ? formatFullName(payment.studentFee.student.firstName, payment.studentFee.student.lastName) : "Student",
        amount: String(payment?.amount || 0),
        paymentMode: payment?.paymentMode || "cash",
      };
    }

    default:
      return {};
  }
}
