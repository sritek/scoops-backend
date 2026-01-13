import type { FastifyRequest } from "fastify";
import type { AuthUser, UserContext } from "./auth.js";

/**
 * Request with authenticated user (token verified).
 * Use this for routes that only need Firebase token verification.
 */
export interface AuthenticatedRequest extends FastifyRequest {
  authUser: AuthUser;
}

/**
 * Request with authenticated user AND full user context.
 * Use this for routes that need role, permissions, org/branch context.
 * Requires additional middleware to load user from DB.
 */
export interface ProtectedRequest extends FastifyRequest {
  authUser: AuthUser;
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
