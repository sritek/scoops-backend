import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination.js";

/**
 * Payment mode enum
 */
export const PaymentMode = {
  CASH: "cash",
  UPI: "upi",
  BANK: "bank",
} as const;

// =====================
// Receipt Schemas
// =====================

/**
 * Schema for receipt ID param
 */
export const receiptIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Schema for payment ID param (installment payment)
 */
export const paymentIdParamSchema = z.object({
  paymentId: z.string().uuid(),
});

/**
 * Schema for listing receipts with pagination and filters
 */
export const listReceiptsQuerySchema = paginationQuerySchema.extend({
  studentId: z.string().uuid().optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  search: z.string().optional(),
});

/**
 * Type definitions for receipts
 */
export type ReceiptIdParam = z.infer<typeof receiptIdParamSchema>;
export type ListReceiptsQuery = z.infer<typeof listReceiptsQuerySchema>;
