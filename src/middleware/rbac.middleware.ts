import type { FastifyReply } from "fastify";
import type { Permission } from "../types/auth.js";
import type { ProtectedRequest } from "../types/request.js";

/**
 * RBAC middleware factory.
 * Creates a middleware that checks if user has required permission(s).
 *
 * @param requiredPermissions - Single permission or array of permissions (ANY match)
 * @returns Fastify preHandler middleware
 *
 * Usage:
 *   app.get('/students', { preHandler: [authMiddleware, requirePermission('STUDENT_VIEW')] }, handler);
 *   app.post('/fees', { preHandler: [authMiddleware, requirePermission(['FEE_VIEW', 'FEE_UPDATE'])] }, handler);
 */
export function requirePermission(
  requiredPermissions: Permission | Permission[]
) {
  const permissions = Array.isArray(requiredPermissions)
    ? requiredPermissions
    : [requiredPermissions];

  return async function rbacMiddleware(
    request: ProtectedRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Ensure user context exists (auth middleware must run first)
    if (!request.userContext) {
      request.log.error("RBAC middleware called without user context");
      reply.code(500).send({
        error: "Internal Server Error",
        message: "Authentication context missing",
      });
      return;
    }

    const userPermissions = request.userContext.permissions;

    // Check if user has ANY of the required permissions
    const hasPermission = permissions.some((permission) =>
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      request.log.warn({
        userId: request.userContext.userId,
        role: request.userContext.role,
        required: permissions,
        actual: userPermissions,
        message: "Permission denied",
      });

      // Note: Do not expose required permissions in response (security)
      reply.code(403).send({
        error: "Forbidden",
        message: "You do not have permission to perform this action",
      });
      return;
    }
  };
}

/**
 * RBAC middleware factory for requiring ALL permissions.
 * User must have ALL specified permissions to access the route.
 *
 * @param requiredPermissions - Array of permissions (ALL must match)
 * @returns Fastify preHandler middleware
 *
 * Usage:
 *   app.post('/admin-action', { preHandler: [authMiddleware, requireAllPermissions(['USER_MANAGE', 'SETTINGS_MANAGE'])] }, handler);
 */
export function requireAllPermissions(requiredPermissions: Permission[]) {
  return async function rbacAllMiddleware(
    request: ProtectedRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Ensure user context exists (auth middleware must run first)
    if (!request.userContext) {
      request.log.error("RBAC middleware called without user context");
      reply.code(500).send({
        error: "Internal Server Error",
        message: "Authentication context missing",
      });
      return;
    }

    const userPermissions = request.userContext.permissions;

    // Check if user has ALL required permissions
    const missingPermissions = requiredPermissions.filter(
      (permission) => !userPermissions.includes(permission)
    );

    if (missingPermissions.length > 0) {
      request.log.warn({
        userId: request.userContext.userId,
        role: request.userContext.role,
        required: requiredPermissions,
        missing: missingPermissions,
        message: "Permission denied - missing required permissions",
      });

      // Note: Do not expose required/missing permissions in response (security)
      reply.code(403).send({
        error: "Forbidden",
        message: "You do not have permission to perform this action",
      });
      return;
    }
  };
}

/**
 * RBAC middleware for role-based access.
 * Restricts access to specific roles.
 *
 * @param allowedRoles - Single role or array of roles
 * @returns Fastify preHandler middleware
 *
 * Usage:
 *   app.get('/admin-only', { preHandler: [authMiddleware, requireRole('admin')] }, handler);
 */
export function requireRole(allowedRoles: string | string[]) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return async function roleMiddleware(
    request: ProtectedRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Ensure user context exists (auth middleware must run first)
    if (!request.userContext) {
      request.log.error("Role middleware called without user context");
      reply.code(500).send({
        error: "Internal Server Error",
        message: "Authentication context missing",
      });
      return;
    }

    const userRole = request.userContext.role;

    if (!roles.includes(userRole)) {
      request.log.warn({
        userId: request.userContext.userId,
        role: userRole,
        allowedRoles: roles,
        message: "Role access denied",
      });

      reply.code(403).send({
        error: "Forbidden",
        message: "Your role does not have access to this resource",
      });
      return;
    }
  };
}
