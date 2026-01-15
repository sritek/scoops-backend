import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination.js";

/**
 * Academic level enum
 */
export const AcademicLevel = {
  PRIMARY: "primary",
  SECONDARY: "secondary",
  SENIOR_SECONDARY: "senior_secondary",
  COACHING: "coaching",
} as const;

/**
 * Stream enum (optional)
 */
export const BatchStream = {
  SCIENCE: "science",
  COMMERCE: "commerce",
  ARTS: "arts",
} as const;

/**
 * Schema for creating a batch
 */
export const createBatchSchema = z.object({
  name: z.string().min(1).max(255),
  academicLevel: z.enum(["primary", "secondary", "senior_secondary", "coaching"]),
  stream: z.enum(["science", "commerce", "arts"]).optional(),
  teacherId: z.string().uuid().optional(),
  isActive: z.boolean().optional().default(true),
});

/**
 * Schema for updating a batch
 */
export const updateBatchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  academicLevel: z.enum(["primary", "secondary", "senior_secondary", "coaching"]).optional(),
  stream: z.enum(["science", "commerce", "arts"]).nullable().optional(),
  teacherId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Schema for batch ID param
 */
export const batchIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Schema for listing batches with pagination and filters
 */
export const listBatchesQuerySchema = paginationQuerySchema.extend({
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined;
    }),
  teacherId: z.string().uuid().optional(),
  academicLevel: z
    .enum(["primary", "secondary", "senior_secondary", "coaching"])
    .optional(),
});

/**
 * Type definitions
 */
export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
export type BatchIdParam = z.infer<typeof batchIdParamSchema>;
export type ListBatchesQuery = z.infer<typeof listBatchesQuerySchema>;

/**
 * Batch filters for service layer
 */
export interface BatchFilters {
  isActive?: boolean;
  teacherId?: string;
  academicLevel?: string;
}