import type { FastifyRequest } from "fastify";
import type { UserContext } from "./auth.js";

/**
 * Request with authenticated user AND full user context.
 * Use this for routes that need role, permissions, org/branch context.
 * The auth middleware verifies JWT and loads user from DB.
 */
export interface ProtectedRequest extends FastifyRequest {
  userContext: UserContext;
}

/**
 * Extract user context from request.
 * Use this in route handlers for type safety.
 */
export function getContext(request: ProtectedRequest): UserContext {
  return request.userContext;
}

/**
 * Tenant scope for database queries.
 * Every query must include this.
 */
export interface TenantScope {
  orgId: string;
  branchId: string;
}

/**
 * Extract tenant scope from request context.
 * Use this for all database queries.
 */
export function getTenantScope(request: ProtectedRequest): TenantScope {
  return {
    orgId: request.userContext.orgId,
    branchId: request.userContext.branchId,
  };
}
