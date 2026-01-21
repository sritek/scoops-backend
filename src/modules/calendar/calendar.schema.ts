/**
 * Calendar Schema Definitions
 *
 * Zod schemas for validating calendar/academic event data
 */

import { z } from "zod";

/**
 * Academic event type enum
 */
export const academicEventTypeSchema = z.enum([
  "holiday",
  "exam",
  "ptm",
  "event",
  "deadline",
]);

export type AcademicEventType = z.infer<typeof academicEventTypeSchema>;

/**
 * Create academic event schema
 */
export const createEventSchema = z.object({
  batchId: z.string().uuid().nullable().optional(), // null = school-wide
  type: academicEventTypeSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format").nullable().optional(),
  isAllDay: z.boolean().default(true),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;

/**
 * Update academic event schema
 */
export const updateEventSchema = z.object({
  batchId: z.string().uuid().nullable().optional(),
  type: academicEventTypeSchema.optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format").optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format").nullable().optional(),
  isAllDay: z.boolean().optional(),
});

export type UpdateEventInput = z.infer<typeof updateEventSchema>;

/**
 * Query parameters for listing events
 */
export const eventQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
  batchId: z.string().uuid().optional(),
  type: academicEventTypeSchema.optional(),
});

export type EventQueryInput = z.infer<typeof eventQuerySchema>;
