import type { FastifyRequest, FastifyReply } from "fastify";
import type { AuthUser, UserContext, Role } from "../types/auth.js";
import { verifyIdToken } from "../config/firebase.js";
import { prisma } from "../config/database.js";
import { getPermissionsForRole } from "../config/permissions.js";
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
 * Look up user in database by phone or email
 * Phone is preferred since Firebase Phone Auth is primary
 */
async function loadUserFromDb(authUser: AuthUser, log: FastifyRequest["log"]) {
  log.debug(
    { phone: authUser.phone ?? null, email: authUser.email ?? null },
    "Looking up user in database"
  );

  console.log("authUser", authUser);

  // Look up by phone first (primary), then email (fallback)
  const whereClause = authUser.phone
    ? { phone: authUser.phone }
    : authUser.email
    ? { email: authUser.email }
    : null;

  if (!whereClause) {
    log.warn("No phone or email available for user lookup");
    return null;
  }

  const user = await prisma.user.findFirst({
    where: whereClause,
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
 * - Verifies Firebase ID token
 * - Looks up user in database by phone/email
 * - Validates user exists, is active, and has branch access
 * - Builds and attaches userContext with role and permissions
 *
 * Security:
 * - Role comes from DB, NOT from token
 * - Org/Branch comes from DB, NOT from frontend
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

  // Step 2: Verify Firebase token
  log.debug({ step: 2 }, "Verifying Firebase ID token");
  const decoded = await verifyIdToken(token);

  if (!decoded) {
    log.warn("Invalid or expired token");
    reply.code(401).send({
      error: "Unauthorized",
      message: "Invalid or expired token",
    });
    return;
  }

  log.debug({ uid: decoded.uid }, "Token verified");

  const authUser: AuthUser = {
    id: decoded.uid,
    email: decoded.email || null,
    phone: decoded.phone_number || null,
  };

  // Step 3: Load user from database
  log.debug({ step: 3 }, "Loading user from database");
  const dbUser = await loadUserFromDb(authUser, log);

  if (!dbUser) {
    log.warn({ firebaseUid: decoded.uid }, "User not found in system");
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
  request.authUser = authUser;
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
