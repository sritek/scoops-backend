import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination.js";

/**
 * Installment status enum values
 */
export const InstallmentStatus = {
  UPCOMING: "upcoming",
  DUE: "due",
  OVERDUE: "overdue",
  PARTIAL: "partial",
  PAID: "paid",
} as const;

/**
 * Schema for EMI split configuration
 */
export const emiSplitConfigSchema = z.array(
  z.object({
    percent: z.number().min(1).max(100),
    dueDaysFromStart: z.number().min(0),
  })
);

/**
 * Schema for creating an EMI plan template
 */
export const createEMIPlanTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  installmentCount: z.number().min(1).max(24),
  splitConfig: emiSplitConfigSchema,
  isDefault: z.boolean().optional().default(false),
});

/**
 * Schema for updating an EMI plan template
 */
export const updateEMIPlanTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  splitConfig: emiSplitConfigSchema.optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Schema for EMI template ID param
 */
export const emiTemplateIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Schema for generating installments
 */
export const generateInstallmentsSchema = z.object({
  studentFeeStructureId: z.string().uuid(),
  emiTemplateId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
});

/**
 * Schema for recording installment payment
 */
export const recordInstallmentPaymentSchema = z.object({
  installmentId: z.string().uuid(),
  amount: z.number().positive(),
  paymentMode: z.enum(["cash", "upi", "bank"]),
  transactionRef: z.string().max(100).optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Schema for installment ID param
 */
export const installmentIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Schema for student ID param
 */
export const studentIdParamSchema = z.object({
  studentId: z.string().uuid(),
});

/**
 * Schema for listing pending installments
 */
export const listPendingInstallmentsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["upcoming", "due", "overdue", "partial", "paid"]).optional(),
  batchId: z.string().uuid().optional(),
  search: z.string().min(1).max(100).optional(),
});

/**
 * Type definitions
 */
export type EMISplitConfig = z.infer<typeof emiSplitConfigSchema>;
export type CreateEMIPlanTemplateInput = z.infer<typeof createEMIPlanTemplateSchema>;
export type UpdateEMIPlanTemplateInput = z.infer<typeof updateEMIPlanTemplateSchema>;
export type EMITemplateIdParam = z.infer<typeof emiTemplateIdParamSchema>;
export type GenerateInstallmentsInput = z.infer<typeof generateInstallmentsSchema>;
export type RecordInstallmentPaymentInput = z.infer<typeof recordInstallmentPaymentSchema>;
export type InstallmentIdParam = z.infer<typeof installmentIdParamSchema>;
export type StudentIdParam = z.infer<typeof studentIdParamSchema>;
export type ListPendingInstallmentsQuery = z.infer<typeof listPendingInstallmentsQuerySchema>;

/**
 * Pending installments filters for service layer
 */
export interface PendingInstallmentsFilters {
  status?: "upcoming" | "due" | "overdue" | "partial" | "paid";
  batchId?: string;
  search?: string;
}
