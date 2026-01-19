import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination.js";

/**
 * Schema for creating an academic session
 */
export const createSessionSchema = z.object({
  name: z.string().min(1).max(100), // "2025-26"
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  isCurrent: z.boolean().optional().default(false),
});

/**
 * Schema for updating an academic session
 */
export const updateSessionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  isCurrent: z.boolean().optional(),
});

/**
 * Schema for session ID param
 */
export const sessionIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Schema for listing sessions with pagination
 */
export const listSessionsQuerySchema = paginationQuerySchema.extend({
  isCurrent: z
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
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
export type SessionIdParam = z.infer<typeof sessionIdParamSchema>;
export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>;

/**
 * Session filters for service layer
 */
export interface SessionFilters {
  isCurrent?: boolean;
}
