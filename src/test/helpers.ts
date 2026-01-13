import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

/**
 * Build a Fastify app instance for testing
 */
export async function buildTestApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  return app;
}

/**
 * Create a mock JWT token for testing
 * This matches the format expected by auth.middleware.ts
 */
export function createTestToken(email: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64");
  const payload = Buffer.from(
    JSON.stringify({
      uid: `test-uid-${email}`,
      email: email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString("base64");
  const signature = Buffer.from("test-signature").toString("base64");

  return `${header}.${payload}.${signature}`;
}

/**
 * Create authorization header with Bearer token
 */
export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Create headers for authenticated requests
 */
export function getAuthHeaders(email: string): { Authorization: string } {
  return authHeader(createTestToken(email));
}
