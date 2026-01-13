import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

/**
 * Logging context middleware plugin.
 * Enriches request logger with user context after authentication.
 * 
 * This creates a child logger with userId, orgId, and branchId
 * so all subsequent logs in the request include this context.
 */
export async function loggingContextPlugin(app: FastifyInstance): Promise<void> {
  // Hook runs after preHandler (where auth middleware runs)
  app.addHook("preHandler", async (request: FastifyRequest) => {
    // Only enrich if user context is available (after auth)
    if (request.userContext) {
      // Create child logger with user context
      request.log = request.log.child({
        userId: request.userContext.userId,
        orgId: request.userContext.orgId,
        branchId: request.userContext.branchId,
        role: request.userContext.role,
      });
    }
  });

  // Log response time and status
  app.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    request.log.info({
      responseTime: reply.elapsedTime,
      statusCode: reply.statusCode,
    }, "request completed");
  });
}

/**
 * Log an action with context (for use in services/controllers)
 */
export function logAction(
  request: FastifyRequest,
  action: string,
  details?: Record<string, unknown>
): void {
  request.log.info({
    action,
    ...details,
  }, action);
}

/**
 * Log a warning with context
 */
export function logWarning(
  request: FastifyRequest,
  message: string,
  details?: Record<string, unknown>
): void {
  request.log.warn({
    ...details,
  }, message);
}

/**
 * Log an error with context
 */
export function logError(
  request: FastifyRequest,
  error: Error,
  details?: Record<string, unknown>
): void {
  request.log.error({
    err: error,
    ...details,
  }, error.message);
}
