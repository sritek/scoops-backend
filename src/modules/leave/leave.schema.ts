/**
 * Leave Application Schemas
 *
 * Zod schemas for leave application validation
 */

import { z } from "zod";

/**
 * Student leave type enum
 */
export const studentLeaveTypeSchema = z.enum([
  "sick",
  "family",
  "vacation",
  "medical",
  "other",
]);

/**
 * Student leave status enum
 */
export const studentLeaveStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

/**
 * Submit leave application schema (parent)
 */
export const submitLeaveSchema = z.object({
  type: studentLeaveTypeSchema,
  reason: z.string().min(10, "Reason must be at least 10 characters").max(500),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
});

export type SubmitLeaveSchema = z.infer<typeof submitLeaveSchema>;

/**
 * Review leave application schema (staff)
 */
export const reviewLeaveSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewNote: z.string().max(500).optional(),
});

export type ReviewLeaveSchema = z.infer<typeof reviewLeaveSchema>;

/**
 * Leave applications query schema
 */
export const leaveQuerySchema = z.object({
  status: studentLeaveStatusSchema.optional(),
  batchId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type LeaveQuerySchema = z.infer<typeof leaveQuerySchema>;
