import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions";
import * as controller from "./auth.controller.js";

/**
 * Auth module routes
 * Login route is public, others require authentication
 */
export async function authRoutes(app: FastifyInstance) {
  /**
   * POST /auth/login
   * Public endpoint - no auth required
   */
  app.post(
    "/login",
    {
      schema: {
        tags: ["Auth"],
        summary: "Login with employee ID and password",
        description: "Authenticates user and returns JWT token",
        body: {
          type: "object",
          required: ["employeeId", "password"],
          properties: {
            employeeId: {
              type: "string",
              description: "Employee ID (e.g., XK7R2M)",
              minLength: 1,
              maxLength: 20,
            },
            password: {
              type: "string",
              description: "User password",
              minLength: 1,
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              token: { type: "string", description: "JWT access token" },
              user: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  employeeId: { type: "string" },
                  firstName: { type: "string" },
                  lastName: { type: "string" },
                  photoUrl: { type: "string", nullable: true },
                  role: { type: "string" },
                  permissions: { type: "array", items: { type: "string" } },
                  branchId: { type: "string" },
                  orgId: { type: "string" },
                  mustChangePassword: { type: "boolean" },
                },
              },
            },
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    controller.login
  );

  /**
   * POST /auth/change-password
   * Requires authentication
   */
  app.post(
    "/change-password",
    {
      schema: {
        tags: ["Auth"],
        summary: "Change current user's password",
        description: "Allows authenticated user to change their password",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["currentPassword", "newPassword", "confirmPassword"],
          properties: {
            currentPassword: {
              type: "string",
              description: "Current password",
            },
            newPassword: {
              type: "string",
              description:
                "New password (min 8 chars, must include uppercase, lowercase, and number)",
              minLength: 8,
            },
            confirmPassword: {
              type: "string",
              description: "Confirm new password",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    controller.changePassword
  );

  /**
   * POST /auth/reset-password
   * Admin only - reset another user's password
   */
  app.post(
    "/reset-password",
    {
      schema: {
        tags: ["Auth"],
        summary: "Reset a user's password (Admin only)",
        description:
          "Allows admin to reset another user's password. User will be required to change password on next login.",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["userId", "newPassword"],
          properties: {
            userId: {
              type: "string",
              format: "uuid",
              description: "ID of user whose password to reset",
            },
            newPassword: {
              type: "string",
              description: "New temporary password",
              minLength: 8,
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
      preHandler: [requirePermission(PERMISSIONS.USER_MANAGE)],
    },
    controller.resetPassword
  );

  /**
   * GET /auth/me
   * Get current user profile
   */
  app.get(
    "/me",
    {
      schema: {
        tags: ["Auth"],
        summary: "Get current user profile",
        description:
          "Returns the authenticated user's full profile information",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              employeeId: { type: "string" },
              firstName: { type: "string" },
              lastName: { type: "string" },
              name: { type: "string" },
              phone: { type: "string" },
              email: { type: "string", nullable: true },
              photoUrl: { type: "string", nullable: true },
              role: { type: "string" },
              permissions: { type: "array", items: { type: "string" } },
              branchId: { type: "string" },
              branchName: { type: "string" },
              organizationId: { type: "string" },
              organizationName: { type: "string" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    controller.getMe
  );

  /**
   * PUT /auth/me
   * Update current user profile
   */
  app.put(
    "/me",
    {
      schema: {
        tags: ["Auth"],
        summary: "Update current user profile",
        description:
          "Updates the authenticated user's profile information (name, phone, email, photo)",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            firstName: { type: "string", minLength: 1, maxLength: 255 },
            lastName: { type: "string", minLength: 1, maxLength: 255 },
            phone: { type: "string", minLength: 10, maxLength: 15 },
            email: { type: "string", format: "email", nullable: true },
            photoUrl: {
              type: "string",
              description: "Base64 encoded photo (jpeg, png, or webp)",
              nullable: true,
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  firstName: { type: "string" },
                  lastName: { type: "string" },
                  name: { type: "string" },
                  phone: { type: "string" },
                  email: { type: "string", nullable: true },
                  photoUrl: { type: "string", nullable: true },
                  role: { type: "string" },
                },
              },
              message: { type: "string" },
            },
          },
        },
      },
    },
    controller.updateMe
  );
}
