/**
 * Calendar Service
 *
 * Business logic for managing academic calendar events
 */

import { prisma } from "../../config/database.js";
import { NotFoundError } from "../../utils/error-handler.js";
import type { TenantScope } from "../../types/request.js";
import type {
  CreateEventInput,
  UpdateEventInput,
  EventQueryInput,
} from "./calendar.schema.js";
import type { AcademicEventType, Prisma } from "@prisma/client";

/**
 * Get events for a given month/year with optional filters
 */
export async function getEvents(scope: TenantScope, query: EventQueryInput) {
  const { month, year, batchId, type } = query;

  // Calculate date range for the month
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0); // Last day of month

  // Build where clause
  const where: Prisma.AcademicEventWhereInput = {
    orgId: scope.orgId,
    branchId: scope.branchId,
  };

  // Filter by batch (include school-wide events if batchId is specified)
  if (batchId) {
    where.OR = [
      { batchId: batchId },
      { batchId: null }, // Always include school-wide events
    ];
  }

  if (type) {
    where.type = type as AcademicEventType;
  }

  // Get events that overlap with the month
  const events = await prisma.academicEvent.findMany({
    where: {
      ...where,
      AND: [
        {
          OR: [
            // Event starts in this month
            {
              startDate: {
                gte: startOfMonth,
                lte: endOfMonth,
              },
            },
            // Event ends in this month
            {
              endDate: {
                gte: startOfMonth,
                lte: endOfMonth,
              },
            },
            // Event spans the entire month
            {
              startDate: { lte: startOfMonth },
              endDate: { gte: endOfMonth },
            },
          ],
        },
      ],
    },
    include: {
      batch: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { startDate: "asc" },
  });

  return events.map((e) => ({
    id: e.id,
    type: e.type,
    title: e.title,
    description: e.description,
    startDate: e.startDate.toISOString().split("T")[0],
    endDate: e.endDate?.toISOString().split("T")[0] ?? null,
    isAllDay: e.isAllDay,
    batchId: e.batchId,
    batchName: e.batch?.name ?? null,
    isSchoolWide: e.batchId === null,
    createdBy: {
      id: e.createdBy.id,
      name: `${e.createdBy.firstName} ${e.createdBy.lastName}`,
    },
    createdAt: e.createdAt.toISOString(),
  }));
}

/**
 * Get a single event by ID
 */
export async function getEvent(id: string, scope: TenantScope) {
  const event = await prisma.academicEvent.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
    include: {
      batch: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!event) {
    throw new NotFoundError("Event not found");
  }

  return {
    id: event.id,
    type: event.type,
    title: event.title,
    description: event.description,
    startDate: event.startDate.toISOString().split("T")[0],
    endDate: event.endDate?.toISOString().split("T")[0] ?? null,
    isAllDay: event.isAllDay,
    batchId: event.batchId,
    batchName: event.batch?.name ?? null,
    isSchoolWide: event.batchId === null,
    createdBy: {
      id: event.createdBy.id,
      name: `${event.createdBy.firstName} ${event.createdBy.lastName}`,
    },
    createdAt: event.createdAt.toISOString(),
  };
}

/**
 * Create a new academic event
 */
export async function createEvent(
  input: CreateEventInput,
  scope: TenantScope,
  userId: string
) {
  // Validate batch exists if provided
  if (input.batchId) {
    const batch = await prisma.batch.findFirst({
      where: {
        id: input.batchId,
        branchId: scope.branchId,
      },
    });

    if (!batch) {
      throw new NotFoundError("Batch not found");
    }
  }

  const event = await prisma.academicEvent.create({
    data: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      batchId: input.batchId ?? null,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      startDate: new Date(input.startDate),
      endDate: input.endDate ? new Date(input.endDate) : null,
      isAllDay: input.isAllDay ?? true,
      createdById: userId,
    },
    include: {
      batch: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return {
    id: event.id,
    type: event.type,
    title: event.title,
    description: event.description,
    startDate: event.startDate.toISOString().split("T")[0],
    endDate: event.endDate?.toISOString().split("T")[0] ?? null,
    isAllDay: event.isAllDay,
    batchId: event.batchId,
    batchName: event.batch?.name ?? null,
    isSchoolWide: event.batchId === null,
    createdBy: {
      id: event.createdBy.id,
      name: `${event.createdBy.firstName} ${event.createdBy.lastName}`,
    },
    createdAt: event.createdAt.toISOString(),
  };
}

/**
 * Update an existing academic event
 */
export async function updateEvent(
  id: string,
  input: UpdateEventInput,
  scope: TenantScope
) {
  // Verify event exists
  const existing = await prisma.academicEvent.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!existing) {
    throw new NotFoundError("Event not found");
  }

  // Validate batch if being updated
  if (input.batchId !== undefined && input.batchId !== null) {
    const batch = await prisma.batch.findFirst({
      where: {
        id: input.batchId,
        branchId: scope.branchId,
      },
    });

    if (!batch) {
      throw new NotFoundError("Batch not found");
    }
  }

  const event = await prisma.academicEvent.update({
    where: { id },
    data: {
      batchId: input.batchId !== undefined ? input.batchId : undefined,
      type: input.type,
      title: input.title,
      description: input.description,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate:
        input.endDate !== undefined
          ? input.endDate
            ? new Date(input.endDate)
            : null
          : undefined,
      isAllDay: input.isAllDay,
    },
    include: {
      batch: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return {
    id: event.id,
    type: event.type,
    title: event.title,
    description: event.description,
    startDate: event.startDate.toISOString().split("T")[0],
    endDate: event.endDate?.toISOString().split("T")[0] ?? null,
    isAllDay: event.isAllDay,
    batchId: event.batchId,
    batchName: event.batch?.name ?? null,
    isSchoolWide: event.batchId === null,
    createdBy: {
      id: event.createdBy.id,
      name: `${event.createdBy.firstName} ${event.createdBy.lastName}`,
    },
    createdAt: event.createdAt.toISOString(),
  };
}

/**
 * Delete an academic event
 */
export async function deleteEvent(id: string, scope: TenantScope) {
  const event = await prisma.academicEvent.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!event) {
    throw new NotFoundError("Event not found");
  }

  await prisma.academicEvent.delete({
    where: { id },
  });

  return { success: true, id };
}

/**
 * Get upcoming events for the next N days
 */
export async function getUpcomingEvents(
  scope: TenantScope,
  days: number = 7,
  batchId?: string
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + days);

  const where: {
    orgId: string;
    branchId: string;
    startDate: { gte: Date; lte: Date };
    batchId?: string | null;
    OR?: Array<{ batchId: string | null }>;
  } = {
    orgId: scope.orgId,
    branchId: scope.branchId,
    startDate: {
      gte: today,
      lte: endDate,
    },
  };

  if (batchId) {
    where.OR = [{ batchId }, { batchId: null }];
  }

  const events = await prisma.academicEvent.findMany({
    where,
    include: {
      batch: { select: { id: true, name: true } },
    },
    orderBy: { startDate: "asc" },
    take: 10,
  });

  return events.map((e) => ({
    id: e.id,
    type: e.type,
    title: e.title,
    startDate: e.startDate.toISOString().split("T")[0],
    batchName: e.batch?.name ?? null,
    isSchoolWide: e.batchId === null,
  }));
}
