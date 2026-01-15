import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination.js";

/**
 * User roles enum (must match Prisma Role enum)
 */
export const UserRoles = {
  ADMIN: "admin",
  TEACHER: "teacher",
  ACCOUNTS: "accounts",
  STAFF: "staff",
} as const;

/**
 * Schema for creating a user
 */
export const createUserSchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional(),
  role: z.enum(["admin", "teacher", "accounts", "staff"]),
  branchId: z.string().uuid().optional(), // If not provided, uses current branch
});

/**
 * Schema for updating a user
 */
export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(255).optional(),
  lastName: z.string().min(1).max(255).optional(),
  phone: z.string().min(10).max(15).optional(),
  email: z.string().email().nullable().optional(),
  role: z.enum(["admin", "teacher", "accounts", "staff"]).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Schema for user ID param
 */
export const userIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Schema for listing users with pagination and filters
 */
export const listUsersQuerySchema = paginationQuerySchema.extend({
  role: z.enum(["admin", "teacher", "accounts", "staff"]).optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined;
    }),
  search: z.string().optional(),
});

/**
 * Schema for resetting user password
 */
export const resetPasswordSchema = z.object({
  userId: z.string().uuid(),
});

/**
 * Type definitions
 */
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserIdParam = z.infer<typeof userIdParamSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

/**
 * User filters for service layer
 */
export interface UserFilters {
  role?: string;
  isActive?: boolean;
  search?: string;
}
