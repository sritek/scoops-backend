/**
 * Reports Zod Schemas
 */

import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination.js";

/**
 * Request report schema
 */
export const requestReportSchema = z.object({
  type: z.enum([
    "attendance_monthly",
    "attendance_batch",
    "fee_collection",
    "fee_defaulters",
    "student_performance",
    "branch_summary",
  ]),
  format: z.enum(["pdf", "excel"]),
  parameters: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    batchId: z.string().uuid().optional(),
    month: z.number().int().min(1).max(12).optional(),
    year: z.number().int().min(2000).max(2100).optional(),
  }).optional().default({}),
});

/**
 * Report ID param schema
 */
export const reportIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * List reports query schema
 */
export const listReportsQuerySchema = paginationQuerySchema.extend({
  type: z.enum([
    "attendance_monthly",
    "attendance_batch",
    "fee_collection",
    "fee_defaulters",
    "student_performance",
    "branch_summary",
  ]).optional(),
  status: z.enum(["pending", "generating", "completed", "failed"]).optional(),
});

// Types
export type RequestReportInput = z.infer<typeof requestReportSchema>;
export type ReportIdParam = z.infer<typeof reportIdParamSchema>;
export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;
