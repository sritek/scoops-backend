import { z } from "zod";

/**
 * Base64 photo URL validation for organization logo
 */
const logoUrlSchema = z
  .string()
  .refine(
    (val) =>
      val === "" ||
      val.startsWith("data:image/jpeg;base64,") ||
      val.startsWith("data:image/png;base64,") ||
      val.startsWith("data:image/webp;base64,"),
    { message: "Logo must be a valid Base64 data URL (jpeg, png, or webp)" }
  )
  .refine((val) => val === "" || val.length <= 1000000, {
    message: "Logo size must be less than 750KB",
  })
  .optional()
  .nullable();

/**
 * HH:mm time format validation
 */
const timeFormatSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: "Time must be in HH:mm format (e.g., 09:00)",
  });

/**
 * Schema for updating organization settings
 */
export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.enum(["school", "coaching"]).optional(),
  language: z.string().max(10).optional(),
  timezone: z.string().max(50).optional(),
  udiseCode: z.string().max(50).optional().nullable(),
  logoUrl: logoUrlSchema,
  phone: z.string().min(10).max(15).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  // Notification settings
  notificationsEnabled: z.boolean().optional(),
  feeOverdueCheckTime: timeFormatSchema.optional(),
  feeReminderDays: z.number().int().min(1).max(30).optional(),
  birthdayNotifications: z.boolean().optional(),
  attendanceBufferMinutes: z.number().int().min(0).max(60).optional(),
  // Feature flags
  jobsDashboardEnabled: z.boolean().optional(),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

/**
 * Schema for updating message template
 */
export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  content: z.string().min(1).max(1000).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

/**
 * Schema for creating message template
 */
export const createTemplateSchema = z.object({
  type: z.enum(["absent", "fee_due", "fee_paid", "fee_overdue", "fee_reminder", "birthday"]),
  name: z.string().min(1).max(255),
  content: z.string().min(1).max(1000),
  isActive: z.boolean().default(true),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

/**
 * Template ID param schema
 */
export const templateIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type TemplateIdParam = z.infer<typeof templateIdParamSchema>;
