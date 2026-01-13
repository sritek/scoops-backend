import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { authMiddleware } from "./auth.middleware.js";
import {
  requirePermission,
  requireAllPermissions,
  requireRole,
} from "./rbac.middleware.js";
import {
  branchContextMiddleware,
  getTenantScopeFromRequest,
  belongsToTenant,
  assertBelongsToTenant,
} from "./branch.middleware.js";
import {
  loggingContextPlugin,
  logAction,
  logWarning,
  logError,
} from "./logging.middleware.js";

/**
 * Apply authentication middleware to a route or plugin.
 * This is the central middleware chain for protected routes.
 *
 * Usage in route registration:
 *   app.register(protectedRoutes, { prefix: '/api' });
 *
 * Or per-route:
 *   app.get('/resource', { preHandler: [authMiddleware] }, handler);
 */
export { authMiddleware };

/**
 * RBAC middleware exports.
 *
 * Usage:
 *   app.get('/students', { preHandler: [authMiddleware, requirePermission('STUDENT_VIEW')] }, handler);
 *   app.post('/fees', { preHandler: [authMiddleware, requirePermission('FEE_UPDATE')] }, handler);
 *   app.get('/admin', { preHandler: [authMiddleware, requireRole('admin')] }, handler);
 */
export { requirePermission, requireAllPermissions, requireRole };

/**
 * Branch context middleware and helpers.
 *
 * Usage:
 *   // Middleware - validates branch access
 *   app.get('/resource', { preHandler: [authMiddleware, branchContextMiddleware] }, handler);
 *
 *   // Helper - get tenant scope for queries
 *   const scope = getTenantScopeFromRequest(request);
 *   await prisma.student.findMany({ where: { ...scope } });
 *
 *   // Helper - validate entity ownership
 *   assertBelongsToTenant(entity, scope, 'Student');
 */
export {
  branchContextMiddleware,
  getTenantScopeFromRequest,
  belongsToTenant,
  assertBelongsToTenant,
};

/**
 * Pre-handler hook that applies all security middleware.
 * Order: Auth → Branch Context
 * Use this for protected routes.
 */
export const protectedPreHandler = [authMiddleware, branchContextMiddleware];

/**
 * Register protected routes plugin.
 * All routes registered within this plugin require authentication and branch validation.
 */
export async function protectedRoutes(
  app: FastifyInstance,
  _opts: Record<string, unknown>
): Promise<void> {
  // Apply auth middleware to all routes in this plugin
  app.addHook(
    "preHandler",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await authMiddleware(request, reply);
    }
  );

  // Apply branch context middleware
  app.addHook(
    "preHandler",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await branchContextMiddleware(
        request as FastifyRequest & { userContext: unknown },
        reply
      );
    }
  );
}

/**
 * Route options for protected endpoints.
 * Includes auth + branch context validation.
 */
export const protectedRouteOptions = {
  preHandler: protectedPreHandler,
};

/**
 * Logging helpers.
 *
 * Usage:
 *   import { logAction, logWarning, logError } from '../middleware/index.js';
 *
 *   // Log an action
 *   logAction(request, 'student.created', { studentId: student.id });
 *
 *   // Log a warning
 *   logWarning(request, 'Rate limit approaching', { count: 90 });
 *
 *   // Log an error
 *   logError(request, error, { operation: 'createStudent' });
 */
export { loggingContextPlugin, logAction, logWarning, logError };
