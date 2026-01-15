import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import { buildApp } from "../app.js";
import { env } from "../config/env.js";
import type { Role } from "../types/auth.js";
import { prisma } from "./setup.js";

/**
 * Build a Fastify app instance for testing
 */
export async function buildTestApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  return app;
}

/**
 * JWT payload for test tokens
 */
export interface TestJwtPayload {
  userId: string;
  employeeId: string;
  orgId: string;
  branchId: string;
  role: Role;
}

/**
 * Create a mock JWT token for testing
 * This creates a properly signed JWT that the auth middleware will accept
 */
export function createTestToken(payload: TestJwtPayload): string {
  const options: jwt.SignOptions = {
    expiresIn: "1h",
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

/**
 * Create authorization header with Bearer token
 */
export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Create headers for authenticated requests using a token payload
 */
export function getAuthHeadersFromPayload(payload: TestJwtPayload): { Authorization: string } {
  return authHeader(createTestToken(payload));
}

/**
 * Create headers for authenticated requests by looking up user by email
 * This is the legacy interface for backward compatibility with existing tests
 */
export async function getAuthHeaders(email: string): Promise<{ Authorization: string }> {
  const user = await prisma.user.findFirst({
    where: { email },
    select: {
      id: true,
      employeeId: true,
      orgId: true,
      branchId: true,
      role: true,
    },
  });

  if (!user) {
    throw new Error(`Test user not found with email: ${email}`);
  }

  const payload: TestJwtPayload = {
    userId: user.id,
    employeeId: user.employeeId,
    orgId: user.orgId,
    branchId: user.branchId,
    role: user.role as Role,
  };

  return authHeader(createTestToken(payload));
}

/**
 * Create test token payload for a specific user
 * This is a helper to create token payloads from test fixtures
 */
export function createTokenPayload(
  userId: string,
  employeeId: string,
  orgId: string,
  branchId: string,
  role: Role
): TestJwtPayload {
  return {
    userId,
    employeeId,
    orgId,
    branchId,
    role,
  };
}
