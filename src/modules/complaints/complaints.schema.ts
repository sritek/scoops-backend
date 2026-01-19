/**
 * Complaints Zod Schemas
 */

import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination.js";

export const createComplaintSchema = z.object({
  subject: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  category: z.enum(["fees", "academics", "facilities", "staff", "other"]),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  studentId: z.string().uuid().optional(),
});

export const updateComplaintSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  resolution: z.string().max(5000).optional(),
});

export const addCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  isInternal: z.boolean().optional(),
});

export const complaintIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const listComplaintsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  category: z.string().optional(),
  assignedToId: z.string().uuid().optional(),
});

// Types
export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;
export type UpdateComplaintInput = z.infer<typeof updateComplaintSchema>;
export type AddCommentInput = z.infer<typeof addCommentSchema>;
export type ComplaintIdParam = z.infer<typeof complaintIdParamSchema>;
