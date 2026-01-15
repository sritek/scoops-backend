import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination.js";

/**
 * Fee frequency enum
 */
export const FeeFrequency = {
  MONTHLY: "monthly",
  CUSTOM: "custom",
} as const;

/**
 * Fee status enum
 */
export const FeeStatus = {
  PENDING: "pending",
  PARTIAL: "partial",
  PAID: "paid",
} as const;

/**
 * Payment mode enum
 */
export const PaymentMode = {
  CASH: "cash",
  UPI: "upi",
  BANK: "bank",
} as const;

/**
 * Schema for creating a fee plan
 */
export const createFeePlanSchema = z.object({
  name: z.string().min(1).max(255),
  amount: z.number().positive(),
  frequency: z.enum(["monthly", "custom"]),
});

/**
 * Schema for assigning a fee to a student
 */
export const assignFeeSchema = z.object({
  studentId: z.string().uuid(),
  feePlanId: z.string().uuid(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  totalAmount: z.number().positive().optional(), // Override fee plan amount if needed
});

/**
 * Schema for recording a payment
 */
export const recordPaymentSchema = z.object({
  studentFeeId: z.string().uuid(),
  amount: z.number().positive(),
  paymentMode: z.enum(["cash", "upi", "bank"]),
  notes: z.string().max(500).optional(),
});

/**
 * Schema for student ID param
 */
export const studentIdParamSchema = z.object({
  studentId: z.string().uuid(),
});

/**
 * Schema for listing pending fees with pagination and filters
 */
export const listPendingFeesQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["pending", "partial"]).optional(),
  studentId: z.string().uuid().optional(),
});

/**
 * Schema for listing fee plans with pagination
 */
export const listFeePlansQuerySchema = paginationQuerySchema.extend({
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined;
    }),
});

/**
 * Type definitions
 */
export type CreateFeePlanInput = z.infer<typeof createFeePlanSchema>;
export type AssignFeeInput = z.infer<typeof assignFeeSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type ListPendingFeesQuery = z.infer<typeof listPendingFeesQuerySchema>;
export type ListFeePlansQuery = z.infer<typeof listFeePlansQuerySchema>;

/**
 * Pending fees filters for service layer
 */
export interface PendingFeesFilters {
  status?: "pending" | "partial";
  studentId?: string;
}

/**
 * Fee plans filters for service layer
 */
export interface FeePlansFilters {
  isActive?: boolean;
}