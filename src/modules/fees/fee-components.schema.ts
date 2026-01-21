import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination.js";

/**
 * Fee component type enum values
 */
export const FeeComponentType = {
  TUITION: "tuition",
  ADMISSION: "admission",
  TRANSPORT: "transport",
  LAB: "lab",
  LIBRARY: "library",
  SPORTS: "sports",
  EXAM: "exam",
  UNIFORM: "uniform",
  MISC: "misc",
} as const;

export type FeeComponentTypeValue = (typeof FeeComponentType)[keyof typeof FeeComponentType];

/**
 * Schema for creating a fee component
 */
export const createFeeComponentSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum([
    "tuition",
    "admission",
    "transport",
    "lab",
    "library",
    "sports",
    "exam",
    "uniform",
    "misc",
  ]),
  description: z.string().max(500).optional(),
});

/**
 * Schema for updating a fee component
 */
export const updateFeeComponentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Schema for fee component ID param
 */
export const feeComponentIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Schema for listing fee components with pagination
 */
export const listFeeComponentsQuerySchema = paginationQuerySchema.extend({
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined;
    }),
  type: z
    .enum([
      "tuition",
      "admission",
      "transport",
      "lab",
      "library",
      "sports",
      "exam",
      "uniform",
      "misc",
    ])
    .optional(),
});

/**
 * Type definitions
 */
export type CreateFeeComponentInput = z.infer<typeof createFeeComponentSchema>;
export type UpdateFeeComponentInput = z.infer<typeof updateFeeComponentSchema>;
export type FeeComponentIdParam = z.infer<typeof feeComponentIdParamSchema>;
export type ListFeeComponentsQuery = z.infer<typeof listFeeComponentsQuerySchema>;

/**
 * Fee components filters for service layer
 */
export interface FeeComponentsFilters {
  isActive?: boolean;
  type?: FeeComponentTypeValue;
}
