import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination.js";

/**
 * Schema for creating a subject
 */
export const createSubjectSchema = z.object({
  name: z.string().min(1).max(100), // "Mathematics"
  code: z.string().min(1).max(20).toUpperCase(), // "MATH"
  isActive: z.boolean().optional().default(true),
});

/**
 * Schema for updating a subject
 */
export const updateSubjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().min(1).max(20).toUpperCase().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Schema for subject ID param
 */
export const subjectIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Schema for listing subjects with pagination
 */
export const listSubjectsQuerySchema = paginationQuerySchema.extend({
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined;
    }),
  search: z.string().optional(),
});

/**
 * Type definitions
 */
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
export type SubjectIdParam = z.infer<typeof subjectIdParamSchema>;
export type ListSubjectsQuery = z.infer<typeof listSubjectsQuerySchema>;

/**
 * Subject filters for service layer
 */
export interface SubjectFilters {
  isActive?: boolean;
  search?: string;
}
