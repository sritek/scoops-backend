/**
 * Parent Authentication Routes
 *
 * OTP-based login for parents
 * - POST /auth/parent/request-otp - Request OTP
 * - POST /auth/parent/verify-otp - Verify OTP and get session token
 * - POST /auth/parent/logout - Logout (invalidate session)
 * - GET /auth/parent/me - Get current parent info (requires session)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  requestParentOTP,
  verifyParentOTP,
  validateParentSession,
  logoutParent,
} from "./otp.service.js";
import { BadRequestError } from "../../utils/error-handler.js";

/**
 * Request OTP schema
 */
const requestOTPSchema = z.object({
  phone: z.string().min(10).max(15),
});

/**
 * Verify OTP schema
 */
const verifyOTPSchema = z.object({
  phone: z.string().min(10).max(15),
  otp: z.string().length(6),
});

/**
 * Parent auth routes
 */
export async function parentAuthRoutes(app: FastifyInstance) {
  /**
   * POST /auth/parent/request-otp
   * Request OTP for parent login
   */
  app.post(
    "/request-otp",
    {
      schema: {
        tags: ["Parent Auth"],
        summary: "Request OTP for parent login",
        description: "Sends OTP to parent's WhatsApp number",
        body: {
          type: "object",
          required: ["phone"],
          properties: {
            phone: { type: "string", description: "Phone number (10 digits or with country code)" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              expiresAt: { type: "string", format: "date-time" },
              cooldownSeconds: { type: "number" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = requestOTPSchema.parse(request.body);
      const result = await requestParentOTP(body.phone);
      return reply.code(200).send(result);
    }
  );

  /**
   * POST /auth/parent/verify-otp
   * Verify OTP and get session token
   */
  app.post(
    "/verify-otp",
    {
      schema: {
        tags: ["Parent Auth"],
        summary: "Verify OTP and login",
        description: "Verifies OTP and returns session token for parent",
        body: {
          type: "object",
          required: ["phone", "otp"],
          properties: {
            phone: { type: "string" },
            otp: { type: "string", minLength: 6, maxLength: 6 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              token: { type: "string" },
              parentId: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = verifyOTPSchema.parse(request.body);
      const result = await verifyParentOTP(body.phone, body.otp);

      if (!result.success) {
        return reply.code(400).send(result);
      }

      return reply.code(200).send(result);
    }
  );

  /**
   * GET /auth/parent/me
   * Get current parent info (requires session token)
   */
  app.get(
    "/me",
    {
      schema: {
        tags: ["Parent Auth"],
        summary: "Get current parent info",
        description: "Returns parent profile if session is valid",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              parent: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  firstName: { type: "string" },
                  lastName: { type: "string" },
                  phone: { type: "string" },
                  email: { type: "string", nullable: true },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const token = request.headers["x-parent-token"] as string;

      if (!token) {
        throw new BadRequestError("Session token required");
      }

      const result = await validateParentSession(token);

      if (!result.valid) {
        return reply.code(401).send({
          error: "Invalid or expired session",
        });
      }

      return reply.code(200).send({
        parent: result.parent,
      });
    }
  );

  /**
   * POST /auth/parent/logout
   * Logout parent (invalidate session)
   */
  app.post(
    "/logout",
    {
      schema: {
        tags: ["Parent Auth"],
        summary: "Logout parent",
        description: "Invalidates the parent's session token",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const token = request.headers["x-parent-token"] as string;

      if (!token) {
        return reply.code(200).send({
          success: true,
          message: "Logged out",
        });
      }

      await logoutParent(token);

      return reply.code(200).send({
        success: true,
        message: "Logged out successfully",
      });
    }
  );
}
