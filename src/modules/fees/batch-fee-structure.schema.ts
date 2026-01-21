import { z } from "zod";

/**
 * Schema for a fee line item
 */
export const feeLineItemSchema = z.object({
  feeComponentId: z.string().uuid(),
  amount: z.number().positive(),
});

/**
 * Schema for creating/updating a batch fee structure
 */
export const createBatchFeeStructureSchema = z.object({
  batchId: z.string().uuid(),
  sessionId: z.string().uuid(),
  name: z.string().min(1).max(255),
  lineItems: z.array(feeLineItemSchema).min(1),
});

/**
 * Schema for updating a batch fee structure
 */
export const updateBatchFeeStructureSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  lineItems: z.array(feeLineItemSchema).min(1).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Schema for batch fee structure ID param
 */
export const batchFeeStructureIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Schema for batch ID param
 */
export const batchIdParamSchema = z.object({
  batchId: z.string().uuid(),
});

/**
 * Schema for applying batch fee structure to students
 */
export const applyToStudentsSchema = z.object({
  overwriteExisting: z.boolean().optional().default(false),
});

/**
 * Type definitions
 */
export type FeeLineItem = z.infer<typeof feeLineItemSchema>;
export type CreateBatchFeeStructureInput = z.infer<typeof createBatchFeeStructureSchema>;
export type UpdateBatchFeeStructureInput = z.infer<typeof updateBatchFeeStructureSchema>;
export type BatchFeeStructureIdParam = z.infer<typeof batchFeeStructureIdParamSchema>;
export type BatchIdParam = z.infer<typeof batchIdParamSchema>;
export type ApplyToStudentsInput = z.infer<typeof applyToStudentsSchema>;
