/**
 * Payment Link Zod Schemas
 */

import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination.js";

/**
 * Create payment link schema
 */
export const createPaymentLinkSchema = z.object({
  studentFeeId: z.string().uuid(),
  expiresInDays: z.number().int().min(1).max(30).optional(),
  description: z.string().max(500).optional(),
});

/**
 * Payment link ID param schema
 */
export const paymentLinkIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Short code param schema
 */
export const shortCodeParamSchema = z.object({
  shortCode: z.string().min(6).max(12),
});

/**
 * List payment links query schema
 */
export const listPaymentLinksQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["active", "expired", "paid", "cancelled"]).optional(),
  studentId: z.string().uuid().optional(),
  search: z.string().optional(),
});

// Types
export type CreatePaymentLinkInput = z.infer<typeof createPaymentLinkSchema>;
export type PaymentLinkIdParam = z.infer<typeof paymentLinkIdParamSchema>;
export type ShortCodeParam = z.infer<typeof shortCodeParamSchema>;
export type ListPaymentLinksQuery = z.infer<typeof listPaymentLinksQuerySchema>;
