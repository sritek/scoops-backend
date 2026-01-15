import { z } from "zod";

/**
 * Login request schema
 */
export const loginSchema = z.object({
  employeeId: z
    .string()
    .min(1, "Employee ID is required")
    .max(20, "Employee ID is too long"),
  password: z
    .string()
    .min(1, "Password is required")
    .max(128, "Password is too long"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Change password request schema
 */
export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .max(128, "Password is too long")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Admin reset password request schema
 */
export const resetPasswordSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Base64 photo URL validation
 * Accepts data URLs (data:image/...) up to ~500KB
 * Allows null, undefined, or empty string
 */
const photoUrlSchema = z
  .string()
  .refine(
    (val) =>
      val === "" ||
      val.startsWith("data:image/jpeg;base64,") ||
      val.startsWith("data:image/png;base64,") ||
      val.startsWith("data:image/webp;base64,"),
    { message: "Photo must be a valid Base64 data URL (jpeg, png, or webp)" }
  )
  .refine((val) => val === "" || val.length <= 700000, {
    message: "Photo size must be less than 500KB",
  })
  .nullish()
  .or(z.null())
  .transform((val) => val || null);

/**
 * Update profile request schema
 */
export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(255).optional(),
  lastName: z.string().min(1).max(255).optional(),
  phone: z.string().min(10).max(15).optional(),
  email: z.string().email().max(255).optional().nullable(),
  photoUrl: photoUrlSchema,
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
