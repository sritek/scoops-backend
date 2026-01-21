/**
 * Parent Authentication Middleware
 *
 * Validates parent session token and attaches parent context to request.
 * Uses x-parent-token header for authentication.
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../config/database.js";
import { createModuleLogger } from "../config/logger.js";

const log = createModuleLogger("parent-auth");

/**
 * Parent context attached to request after authentication
 */
export interface ParentContext {
  parentId: string;
  orgId: string;
  branchId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
}

/**
 * Extended FastifyRequest with parent context
 */
declare module "fastify" {
  interface FastifyRequest {
    parentContext?: ParentContext;
  }
}

/**
 * Validate parent session token
 */
async function validateParentToken(token: string): Promise<ParentContext | null> {
  const session = await prisma.parentSession.findFirst({
    where: {
      token,
      expiresAt: {
        gte: new Date(),
      },
    },
    include: {
      parent: {
        select: {
          id: true,
          orgId: true,
          branchId: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  return {
    parentId: session.parent.id,
    orgId: session.parent.orgId,
    branchId: session.parent.branchId,
    firstName: session.parent.firstName,
    lastName: session.parent.lastName,
    phone: session.parent.phone,
    email: session.parent.email,
  };
}

/**
 * Parent authentication middleware
 *
 * Validates x-parent-token header and attaches parent context to request.
 * Returns 401 if token is missing or invalid.
 */
export async function parentAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const requestLog = request.log || log;

  requestLog.debug(
    { method: request.method, url: request.url },
    "Parent authentication started"
  );

  // Extract token from header
  const token = request.headers["x-parent-token"] as string;

  if (!token) {
    requestLog.warn("Missing parent authentication token");
    reply.code(401).send({
      error: "Unauthorized",
      message: "Missing authentication token",
    });
    return;
  }

  // Validate token
  const parentContext = await validateParentToken(token);

  if (!parentContext) {
    requestLog.warn("Invalid or expired parent token");
    reply.code(401).send({
      error: "Unauthorized",
      message: "Invalid or expired token",
    });
    return;
  }

  // Attach parent context to request
  request.parentContext = parentContext;

  requestLog.info(
    {
      parentId: parentContext.parentId,
      orgId: parentContext.orgId,
      branchId: parentContext.branchId,
    },
    "Parent authentication successful"
  );
}

/**
 * Helper to get parent context from request (throws if not authenticated)
 */
export function getParentContext(request: FastifyRequest): ParentContext {
  if (!request.parentContext) {
    throw new Error("Parent authentication required");
  }
  return request.parentContext;
}
