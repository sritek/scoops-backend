import { prisma } from "../../config/database.js";

/**
 * Event types (Phase 1 - Fixed)
 * Do NOT add new events without explicit approval.
 *
 * Allowed events:
 * - attendance_marked: When attendance is saved for a batch
 * - student_absent: When a student is marked absent
 * - fee_created: When a fee is assigned to a student
 * - fee_paid: When a payment is recorded
 */
export const EVENT_TYPES = {
  ATTENDANCE_MARKED: "attendance_marked",
  STUDENT_ABSENT: "student_absent",
  FEE_CREATED: "fee_created",
  FEE_PAID: "fee_paid",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

/**
 * Event status
 */
export const EVENT_STATUS = {
  PENDING: "pending",
  PROCESSED: "processed",
  FAILED: "failed",
} as const;

export type EventStatus = (typeof EVENT_STATUS)[keyof typeof EVENT_STATUS];

/**
 * Event payload structure
 */
export interface EventPayload {
  entityType: string;
  entityId: string;
  data: Record<string, unknown>;
}

/**
 * Stored event structure
 */
export interface StoredEvent {
  id: string;
  type: EventType;
  orgId: string;
  branchId: string;
  payload: EventPayload;
  status: EventStatus;
  createdAt: Date;
  processedAt: Date | null;
}

/**
 * Emit an event after successful DB commit.
 * Events are stored in the database for later processing.
 *
 * IMPORTANT: Only call this AFTER the main transaction has committed.
 * Event emission failure should not break the main flow.
 *
 * @param type - Event type from EVENT_TYPES
 * @param orgId - Organization ID
 * @param branchId - Branch ID
 * @param payload - Event payload with entity details
 * @returns Created event ID or null on failure
 */
export async function emitEvent(
  type: EventType,
  orgId: string,
  branchId: string,
  payload: EventPayload
): Promise<string | null> {
  try {
    const event = await prisma.event.create({
      data: {
        type,
        orgId,
        branchId,
        payload: JSON.stringify(payload),
        status: EVENT_STATUS.PENDING,
      },
    });

    console.log("Event emitted:", { id: event.id, type, orgId, branchId });
    return event.id;
  } catch (error) {
    // Log but don't throw - event emission should not break main flow
    console.error("Failed to emit event:", {
      type,
      orgId,
      branchId,
      payload,
      error,
    });
    return null;
  }
}

/**
 * Emit multiple events in batch.
 * Use this when multiple events need to be emitted together (e.g., multiple absent students).
 *
 * @param events - Array of events to emit
 * @returns Number of events created
 */
export async function emitEvents(
  events: Array<{
    type: EventType;
    orgId: string;
    branchId: string;
    payload: EventPayload;
  }>
): Promise<number> {
  if (events.length === 0) return 0;

  try {
    const result = await prisma.event.createMany({
      data: events.map((e) => ({
        type: e.type,
        orgId: e.orgId,
        branchId: e.branchId,
        payload: JSON.stringify(e.payload),
        status: EVENT_STATUS.PENDING,
      })),
    });

    console.log("Events emitted:", {
      count: result.count,
      types: events.map((e) => e.type),
    });
    return result.count;
  } catch (error) {
    console.error("Failed to emit events:", { count: events.length, error });
    return 0;
  }
}

/**
 * Get pending events for processing - SCOPED BY TENANT.
 * Used by the notification processor to pick up events.
 *
 * @param orgId - Organization ID (required for tenant isolation)
 * @param branchId - Branch ID (required for tenant isolation)
 * @param limit - Maximum number of events to fetch
 * @returns Array of pending events for this tenant
 */
export async function getPendingEvents(
  orgId: string,
  branchId: string,
  limit: number = 100
): Promise<StoredEvent[]> {
  const events = await prisma.event.findMany({
    where: {
      orgId,
      branchId,
      status: EVENT_STATUS.PENDING,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: limit,
  });

  return events.map((e) => ({
    id: e.id,
    type: e.type as EventType,
    orgId: e.orgId,
    branchId: e.branchId,
    payload: safeParsePayload(e.payload, e.id),
    status: e.status as EventStatus,
    createdAt: e.createdAt,
    processedAt: e.processedAt,
  }));
}

/**
 * Safely parse JSON payload with error handling
 */
function safeParsePayload(payloadStr: string, eventId: string): EventPayload {
  try {
    return JSON.parse(payloadStr) as EventPayload;
  } catch {
    console.error(`Failed to parse payload for event ${eventId}:`, payloadStr);
    // Return a default payload structure to prevent cascading failures
    return {
      entityType: "unknown",
      entityId: "unknown",
      data: { _parseError: true, _rawPayload: payloadStr },
    };
  }
}

/**
 * Mark an event as processed.
 *
 * @param eventId - Event ID to mark as processed
 * @param orgId - Organization ID for tenant validation
 * @param branchId - Branch ID for tenant validation
 */
export async function markEventProcessed(
  eventId: string,
  orgId: string,
  branchId: string
): Promise<void> {
  await prisma.event.updateMany({
    where: {
      id: eventId,
      orgId,
      branchId,
    },
    data: {
      status: EVENT_STATUS.PROCESSED,
      processedAt: new Date(),
    },
  });
}

/**
 * Mark an event as failed.
 *
 * @param eventId - Event ID to mark as failed
 * @param orgId - Organization ID for tenant validation
 * @param branchId - Branch ID for tenant validation
 * @param error - Error message
 */
export async function markEventFailed(
  eventId: string,
  orgId: string,
  branchId: string,
  error: string
): Promise<void> {
  // First get the existing event to preserve payload
  const existingEvent = await prisma.event.findFirst({
    where: {
      id: eventId,
      orgId,
      branchId,
    },
  });

  if (!existingEvent) {
    console.error("Event not found for marking as failed:", eventId);
    return;
  }

  // Parse existing payload and add error (with safe parsing)
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(existingEvent.payload) as Record<string, unknown>;
  } catch {
    console.error(
      `Failed to parse payload for event ${eventId}, using empty object`
    );
    payload = {};
  }
  payload._error = error;

  await prisma.event.updateMany({
    where: {
      id: eventId,
      orgId,
      branchId,
    },
    data: {
      status: EVENT_STATUS.FAILED,
      payload: JSON.stringify(payload),
    },
  });
}

/**
 * Get events by type for a branch (for debugging/admin view)
 */
export async function getEventsByType(
  type: EventType,
  orgId: string,
  branchId: string,
  limit: number = 50
): Promise<StoredEvent[]> {
  const events = await prisma.event.findMany({
    where: {
      type,
      orgId,
      branchId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });

  return events.map((e) => ({
    id: e.id,
    type: e.type as EventType,
    orgId: e.orgId,
    branchId: e.branchId,
    payload: safeParsePayload(e.payload, e.id),
    status: e.status as EventStatus,
    createdAt: e.createdAt,
    processedAt: e.processedAt,
  }));
}
