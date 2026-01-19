import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination.js";

/**
 * Schema for a period template slot
 */
export const periodSlotSchema = z.object({
  periodNumber: z.number().int().min(0), // 0 for breaks
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  isBreak: z.boolean().default(false),
  breakName: z.string().max(50).optional(),
});

/**
 * Valid day of week values (1=Mon to 6=Sat)
 */
const dayOfWeekSchema = z.number().int().min(1).max(6);

/**
 * Default active days (Mon-Sat)
 */
export const DEFAULT_ACTIVE_DAYS = [1, 2, 3, 4, 5, 6];

/**
 * Schema for creating a period template
 */
export const createPeriodTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  isDefault: z.boolean().optional().default(false),
  activeDays: z.array(dayOfWeekSchema).min(1).optional().default(DEFAULT_ACTIVE_DAYS),
  slots: z.array(periodSlotSchema).min(1),
});

/**
 * Schema for updating a period template
 */
export const updatePeriodTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isDefault: z.boolean().optional(),
  activeDays: z.array(dayOfWeekSchema).min(1).optional(),
  slots: z.array(periodSlotSchema).min(1).optional(),
});

/**
 * Schema for template ID param
 */
export const templateIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Schema for listing templates with pagination
 */
export const listTemplatesQuerySchema = paginationQuerySchema.extend({
  isDefault: z
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
export type PeriodSlot = z.infer<typeof periodSlotSchema>;
export type CreatePeriodTemplateInput = z.infer<typeof createPeriodTemplateSchema>;
export type UpdatePeriodTemplateInput = z.infer<typeof updatePeriodTemplateSchema>;
export type TemplateIdParam = z.infer<typeof templateIdParamSchema>;
export type ListTemplatesQuery = z.infer<typeof listTemplatesQuerySchema>;

/**
 * Template filters for service layer
 */
export interface TemplateFilters {
  isDefault?: boolean;
}

/**
 * Default 8-period template slots
 */
export const DEFAULT_TEMPLATE_SLOTS: PeriodSlot[] = [
  { periodNumber: 1, startTime: "08:00", endTime: "08:45", isBreak: false },
  { periodNumber: 2, startTime: "08:45", endTime: "09:30", isBreak: false },
  { periodNumber: 3, startTime: "09:30", endTime: "10:15", isBreak: false },
  { periodNumber: 0, startTime: "10:15", endTime: "10:30", isBreak: true, breakName: "Recess" },
  { periodNumber: 4, startTime: "10:30", endTime: "11:15", isBreak: false },
  { periodNumber: 5, startTime: "11:15", endTime: "12:00", isBreak: false },
  { periodNumber: 0, startTime: "12:00", endTime: "12:45", isBreak: true, breakName: "Lunch" },
  { periodNumber: 6, startTime: "12:45", endTime: "13:30", isBreak: false },
  { periodNumber: 7, startTime: "13:30", endTime: "14:15", isBreak: false },
  { periodNumber: 8, startTime: "14:15", endTime: "15:00", isBreak: false },
];
