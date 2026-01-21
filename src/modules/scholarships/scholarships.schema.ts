import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination.js";

/**
 * Scholarship type enum values
 */
export const ScholarshipType = {
  PERCENTAGE: "percentage",
  FIXED_AMOUNT: "fixed_amount",
  COMPONENT_WAIVER: "component_waiver",
} as const;

/**
 * Scholarship basis enum values
 */
export const ScholarshipBasis = {
  MERIT: "merit",
  NEED_BASED: "need_based",
  SPORTS: "sports",
  SIBLING: "sibling",
  STAFF_WARD: "staff_ward",
  GOVERNMENT: "government",
  CUSTOM: "custom",
} as const;

/**
 * Schema for creating a scholarship
 */
export const createScholarshipSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(["percentage", "fixed_amount", "component_waiver"]),
  basis: z.enum([
    "merit",
    "need_based",
    "sports",
    "sibling",
    "staff_ward",
    "government",
    "custom",
  ]),
  value: z.number().positive(), // Percentage (0-100) or fixed amount
  componentId: z.string().uuid().optional(), // Required if type = component_waiver
  maxAmount: z.number().positive().optional(), // Cap for percentage-based
  description: z.string().max(500).optional(),
}).refine(
  (data) => {
    // If type is percentage, value must be 0-100
    if (data.type === "percentage" && (data.value < 0 || data.value > 100)) {
      return false;
    }
    // If type is component_waiver, componentId is required
    if (data.type === "component_waiver" && !data.componentId) {
      return false;
    }
    return true;
  },
  {
    message: "Invalid scholarship configuration",
  }
);

/**
 * Schema for updating a scholarship
 */
export const updateScholarshipSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  value: z.number().positive().optional(),
  maxAmount: z.number().positive().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

/**
 * Schema for scholarship ID param
 */
export const scholarshipIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Schema for assigning scholarship to student
 */
export const assignScholarshipSchema = z.object({
  studentId: z.string().uuid(),
  scholarshipId: z.string().uuid(),
  sessionId: z.string().uuid(),
  remarks: z.string().max(500).optional(),
});

/**
 * Schema for student scholarship ID param
 */
export const studentScholarshipIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Schema for student ID param
 */
export const studentIdParamSchema = z.object({
  studentId: z.string().uuid(),
});

/**
 * Schema for listing scholarships with pagination
 */
export const listScholarshipsQuerySchema = paginationQuerySchema.extend({
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined;
    }),
  type: z.enum(["percentage", "fixed_amount", "component_waiver"]).optional(),
  basis: z
    .enum([
      "merit",
      "need_based",
      "sports",
      "sibling",
      "staff_ward",
      "government",
      "custom",
    ])
    .optional(),
});

/**
 * Type definitions
 */
export type CreateScholarshipInput = z.infer<typeof createScholarshipSchema>;
export type UpdateScholarshipInput = z.infer<typeof updateScholarshipSchema>;
export type ScholarshipIdParam = z.infer<typeof scholarshipIdParamSchema>;
export type AssignScholarshipInput = z.infer<typeof assignScholarshipSchema>;
export type StudentScholarshipIdParam = z.infer<typeof studentScholarshipIdParamSchema>;
export type StudentIdParam = z.infer<typeof studentIdParamSchema>;
export type ListScholarshipsQuery = z.infer<typeof listScholarshipsQuerySchema>;

/**
 * Scholarships filters for service layer
 */
export interface ScholarshipsFilters {
  isActive?: boolean;
  type?: "percentage" | "fixed_amount" | "component_waiver";
  basis?: "merit" | "need_based" | "sports" | "sibling" | "staff_ward" | "government" | "custom";
}
