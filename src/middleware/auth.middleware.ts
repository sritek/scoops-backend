import type { FastifyRequest, FastifyReply } from "fastify";
import type { UserContext, Role } from "../types/auth.js";
import { verifyToken, type JwtPayload } from "../modules/auth/auth.service.js";
import { prisma } from "../config/database.js";
import { getPermissionsForRole } from "../config/permissions";
import { createModuleLogger } from "../config/logger.js";

// Fallback logger for when request.log is not available
const moduleLog = createModuleLogger("auth");

/**
 * Extract Bearer token from Authorization header
 */
function extractToken(
  authHeader: string | undefined,
  log: FastifyRequest["log"]
): string | null {
  if (!authHeader) {
    log.debug("No Authorization header present");
    return null;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    log.debug("Invalid Authorization header format");
    return null;
  }

  log.debug("Bearer token extracted");
  return parts[1];
}

/**
 * Load user from database by ID (from JWT payload)
 */
async function loadUserFromDb(payload: JwtPayload, log: FastifyRequest["log"]) {
  log.debug({ userId: payload.userId }, "Looking up user in database");

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      orgId: true,
      branchId: true,
      role: true,
      isActive: true,
      firstName: true,
      lastName: true,
    },
  });

  if (user) {
    log.debug({ userId: user.id, role: user.role }, "User found in database");
  } else {
    log.debug("User not found in database");
  }

  return user;
}

/**
 * Authentication middleware
 *
 * Responsibilities:
 * - Extracts Bearer token from Authorization header
 * - Verifies JWT token
 * - Looks up user in database to ensure still valid
 * - Validates user exists, is active, and has branch access
 * - Builds and attaches userContext with role and permissions
 *
 * Security:
 * - Role comes from DB, NOT from token
 * - Org/Branch validated from DB
 * - Permissions derived server-side using role mapping
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Use request.log if available, otherwise fall back to module logger
  const log = request.log || moduleLog;

  log.info(
    { method: request.method, url: request.url },
    "Authentication started"
  );

  // Step 1: Extract token
  log.debug({ step: 1 }, "Extracting token from Authorization header");
  const token = extractToken(request.headers.authorization, log);

  if (!token) {
    log.warn("Missing authorization token");
    reply.code(401).send({
      error: "Unauthorized",
      message: "Missing authorization token",
    });
    return;
  }

  // Step 2: Verify JWT token
  log.debug({ step: 2 }, "Verifying JWT token");
  const payload = verifyToken(token);

  if (!payload) {
    log.warn("Invalid or expired token");
    reply.code(401).send({
      error: "Unauthorized",
      message: "Invalid or expired token",
    });
    return;
  }

  log.debug({ userId: payload.userId }, "Token verified");

  // Step 3: Load user from database (verify user still exists and is active)
  log.debug({ step: 3 }, "Loading user from database");
  const dbUser = await loadUserFromDb(payload, log);

  if (!dbUser) {
    log.warn({ userId: payload.userId }, "User not found in system");
    reply.code(403).send({
      error: "Forbidden",
      message: "User not found in system",
    });
    return;
  }

  // Step 4: Validate user is active
  log.debug({ step: 4, userId: dbUser.id }, "Validating user is active");
  if (!dbUser.isActive) {
    log.warn({ userId: dbUser.id }, "User account is inactive");
    reply.code(403).send({
      error: "Forbidden",
      message: "User account is inactive",
    });
    return;
  }

  // Step 5: Validate user has branch assigned
  log.debug({ step: 5, userId: dbUser.id }, "Validating branch assignment");
  if (!dbUser.branchId) {
    log.warn({ userId: dbUser.id }, "User has no branch assigned");
    reply.code(403).send({
      error: "Forbidden",
      message: "User has no branch assigned",
    });
    return;
  }

  // Step 6: Build user context (role from DB, permissions derived server-side)
  log.debug({ step: 6 }, "Building user context");
  const permissions = getPermissionsForRole(dbUser.role as Role);

  const userContext: UserContext = {
    userId: dbUser.id,
    orgId: dbUser.orgId,
    branchId: dbUser.branchId,
    role: dbUser.role as Role,
    permissions,
    firstName: dbUser.firstName,
    lastName: dbUser.lastName,
  };

  // Attach to request
  request.userContext = userContext;

  log.info(
    {
      userId: userContext.userId,
      orgId: userContext.orgId,
      branchId: userContext.branchId,
      role: userContext.role,
    },
    "Authentication successful"
  );
}
