import { z } from "zod";

/**
 * Schema for a student fee line item
 */
export const studentFeeLineItemSchema = z.object({
  feeComponentId: z.string().uuid(),
  originalAmount: z.number().nonnegative(),
  adjustedAmount: z.number().nonnegative(),
  waived: z.boolean().optional().default(false),
  waiverReason: z.string().max(255).optional(),
});

/**
 * Schema for creating a custom student fee structure
 */
export const createStudentFeeStructureSchema = z.object({
  studentId: z.string().uuid(),
  sessionId: z.string().uuid(),
  lineItems: z.array(studentFeeLineItemSchema).min(1),
  remarks: z.string().max(500).optional(),
});

/**
 * Schema for updating a student fee structure
 */
export const updateStudentFeeStructureSchema = z.object({
  lineItems: z.array(studentFeeLineItemSchema).min(1).optional(),
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * Schema for student fee structure ID param
 */
export const studentFeeStructureIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Schema for student ID param
 */
export const studentIdParamSchema = z.object({
  studentId: z.string().uuid(),
});

/**
 * Type definitions
 */
export type StudentFeeLineItemInput = z.infer<typeof studentFeeLineItemSchema>;
export type CreateStudentFeeStructureInput = z.infer<typeof createStudentFeeStructureSchema>;
export type UpdateStudentFeeStructureInput = z.infer<typeof updateStudentFeeStructureSchema>;
export type StudentFeeStructureIdParam = z.infer<typeof studentFeeStructureIdParamSchema>;
export type StudentIdParam = z.infer<typeof studentIdParamSchema>;
