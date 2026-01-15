import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination.js";

/**
 * Schema for creating a branch
 */
export const createBranchSchema = z.object({
  name: z.string().min(1).max(255),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z.string().max(10).optional(),
  isDefault: z.boolean().optional().default(false),
});

/**
 * Schema for updating a branch
 */
export const updateBranchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  address: z.string().max(500).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(100).nullable().optional(),
  pincode: z.string().max(10).nullable().optional(),
  isDefault: z.boolean().optional(),
});

/**
 * Schema for branch ID param
 */
export const branchIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Schema for listing branches with pagination
 */
export const listBranchesQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
});

/**
 * Type definitions
 */
export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type BranchIdParam = z.infer<typeof branchIdParamSchema>;
export type ListBranchesQuery = z.infer<typeof listBranchesQuerySchema>;

/**
 * Branch filters for service layer
 */
export interface BranchFilters {
  search?: string;
}
