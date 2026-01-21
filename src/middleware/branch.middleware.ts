import type { FastifyReply } from "fastify";
import type { ProtectedRequest, TenantScope } from "../types/request.js";
import { UnauthorizedError, NotFoundError, ForbiddenError } from "../utils/error-handler.js";

/**
 * Branch context validation middleware.
 * Ensures user can only access data within their branch.
 *
 * Validates:
 * - branch_id in params matches user's branch
 * - branch_id in body matches user's branch
 * - org_id in params matches user's org
 * - org_id in body matches user's org
 *
 * Must run AFTER auth middleware.
 */
export async function branchContextMiddleware(
  request: ProtectedRequest,
  reply: FastifyReply
): Promise<void> {
  // Ensure user context exists (auth middleware must run first)
  if (!request.userContext) {
    request.log.error("Branch middleware called without user context");
    reply.code(500).send({
      error: "Internal Server Error",
      message: "Authentication context missing",
    });
    return;
  }

  const { orgId, branchId, userId } = request.userContext;

  // Validate branch_id in params
  const paramBranchId = (request.params as Record<string, string>)?.branchId;
  if (paramBranchId && paramBranchId !== branchId) {
    request.log.warn({
      userId,
      userBranchId: branchId,
      requestedBranchId: paramBranchId,
      message: "Cross-branch access attempt via params",
    });
    reply.code(403).send({
      error: "Forbidden",
      message: "You do not have access to this branch",
    });
    return;
  }

  // Validate org_id in params
  const paramOrgId = (request.params as Record<string, string>)?.orgId;
  if (paramOrgId && paramOrgId !== orgId) {
    request.log.warn({
      userId,
      userOrgId: orgId,
      requestedOrgId: paramOrgId,
      message: "Cross-org access attempt via params",
    });
    reply.code(403).send({
      error: "Forbidden",
      message: "You do not have access to this organization",
    });
    return;
  }

  // Validate branch_id in body
  const body = request.body as Record<string, unknown> | undefined;
  if (body?.branchId && body.branchId !== branchId) {
    request.log.warn({
      userId,
      userBranchId: branchId,
      requestedBranchId: body.branchId,
      message: "Cross-branch access attempt via body",
    });
    reply.code(403).send({
      error: "Forbidden",
      message: "You do not have access to this branch",
    });
    return;
  }

  // Validate org_id in body
  if (body?.orgId && body.orgId !== orgId) {
    request.log.warn({
      userId,
      userOrgId: orgId,
      requestedOrgId: body.orgId,
      message: "Cross-org access attempt via body",
    });
    reply.code(403).send({
      error: "Forbidden",
      message: "You do not have access to this organization",
    });
    return;
  }
}

/**
 * Set scope middleware.
 * Sets request.scope from userContext for use in controllers.
 * Must run AFTER auth middleware.
 */
export async function setScopeMiddleware(
  request: ProtectedRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.userContext) {
    throw new UnauthorizedError("User context not found - auth middleware must run first");
  }
  request.scope = {
    orgId: request.userContext.orgId,
    branchId: request.userContext.branchId,
  };
}

/**
 * Get tenant scope for database queries.
 * Use this in all service/repository calls to ensure data isolation.
 *
 * @param request - Protected request with user context
 * @returns TenantScope with orgId and branchId
 *
 * Usage in service:
 *   const scope = getTenantScopeFromRequest(request);
 *   await prisma.student.findMany({
 *     where: { ...scope, status: 'active' }
 *   });
 */
export function getTenantScopeFromRequest(request: ProtectedRequest): TenantScope {
  if (!request.userContext) {
    throw new UnauthorizedError("User context not found - auth middleware must run first");
  }
  return {
    orgId: request.userContext.orgId,
    branchId: request.userContext.branchId,
  };
}

/**
 * Validate that an entity belongs to user's tenant scope.
 * Use this to verify ownership before updates/deletes.
 *
 * @param entity - Entity with orgId and branchId
 * @param scope - Tenant scope from request
 * @returns true if entity belongs to scope
 */
export function belongsToTenant(
  entity: { orgId: string; branchId: string } | null,
  scope: TenantScope
): boolean {
  if (!entity) return false;
  return entity.orgId === scope.orgId && entity.branchId === scope.branchId;
}

/**
 * Assert that an entity belongs to user's tenant scope.
 * Throws if entity doesn't belong to scope.
 *
 * @param entity - Entity with orgId and branchId
 * @param scope - Tenant scope from request
 * @param entityName - Name for error message
 * @throws Error if entity doesn't belong to scope
 */
export function assertBelongsToTenant(
  entity: { orgId: string; branchId: string } | null,
  scope: TenantScope,
  entityName: string = "Resource"
): void {
  if (!entity) {
    throw new NotFoundError(entityName);
  }
  if (!belongsToTenant(entity, scope)) {
    throw new ForbiddenError(`${entityName} does not belong to your branch`);
  }
}
