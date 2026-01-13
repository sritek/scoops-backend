import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import request from "supertest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../helpers.js";
import { prisma } from "../setup.js";
import type { ApiErrorResponse, MeResponse, HealthResponse } from "../types.js";

// Mock Firebase verifyIdToken before importing anything that uses it
vi.mock("../../config/firebase.js", () => ({
  verifyIdToken: vi.fn(),
}));

// Import the mocked function
import { verifyIdToken } from "../../config/firebase.js";
const mockVerifyIdToken = vi.mocked(verifyIdToken);

// Known test data from seed
const TEST_USERS = {
  admin: {
    phone: "9876543210",
    email: "admin@abccoaching.com",
    firstName: "Rajesh",
    lastName: "Kumar",
    role: "admin",
  },
  teacher: {
    phone: "9876543211",
    email: "priya@abccoaching.com",
    firstName: "Priya",
    lastName: "Sharma",
    role: "teacher",
  },
};

// Mock helpers
function mockValidTokenWithPhone(phone: string): void {
  mockVerifyIdToken.mockResolvedValueOnce({
    uid: `test-uid-${phone}`,
    phone_number: phone,
    email: undefined,
  });
}

function mockValidTokenWithEmail(email: string): void {
  mockVerifyIdToken.mockResolvedValueOnce({
    uid: `test-uid-${email}`,
    phone_number: undefined,
    email: email,
  });
}

function mockInvalidToken(): void {
  mockVerifyIdToken.mockResolvedValueOnce(null);
}

describe("Authentication", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  // ============================================
  // Token Validation Tests
  // ============================================
  describe("Token validation", () => {
    it("should return 401 when Authorization header is missing", async () => {
      const response = await request(app.server).get("/me");
      const body = response.body as ApiErrorResponse;

      expect(response.status).toBe(401);
      expect(body.error).toBe("Unauthorized");
      expect(body.message).toBe("Missing authorization token");
    });

    it("should return 401 when Authorization header has wrong format", async () => {
      const response = await request(app.server)
        .get("/me")
        .set({ Authorization: "InvalidFormat token123" });
      const body = response.body as ApiErrorResponse;

      expect(response.status).toBe(401);
      expect(body.error).toBe("Unauthorized");
      expect(body.message).toBe("Missing authorization token");
    });

    it("should return 401 when token is invalid (Firebase rejects)", async () => {
      mockInvalidToken();

      const response = await request(app.server)
        .get("/me")
        .set({ Authorization: "Bearer invalid-token" });
      const body = response.body as ApiErrorResponse;

      expect(response.status).toBe(401);
      expect(body.error).toBe("Unauthorized");
      expect(body.message).toBe("Invalid or expired token");
      expect(mockVerifyIdToken).toHaveBeenCalledWith("invalid-token");
    });

    it("should return 401 when token is expired", async () => {
      mockInvalidToken();

      const response = await request(app.server)
        .get("/me")
        .set({ Authorization: "Bearer expired-token" });
      const body = response.body as ApiErrorResponse;

      expect(response.status).toBe(401);
      expect(body.error).toBe("Unauthorized");
    });
  });

  // ============================================
  // User Validation Tests
  // ============================================
  describe("User validation", () => {
    it("should return 403 when user is not found in database", async () => {
      // Valid token but phone doesn't exist in DB
      mockValidTokenWithPhone("9999999999");

      const response = await request(app.server)
        .get("/me")
        .set({ Authorization: "Bearer valid-token-unknown-user" });
      const body = response.body as ApiErrorResponse;

      expect(response.status).toBe(403);
      expect(body.error).toBe("Forbidden");
      expect(body.message).toBe("User not found in system");
    });

    it("should return 403 when user is inactive", async () => {
      // First, create an inactive user
      const inactiveUser = await prisma.user.create({
        data: {
          orgId: (await prisma.organization.findFirst())!.id,
          branchId: (await prisma.branch.findFirst())!.id,
          firstName: "Inactive",
          lastName: "User",
          phone: "9999888877",
          email: "inactive@test.com",
          role: "staff",
          isActive: false,
        },
      });

      try {
        mockValidTokenWithPhone(inactiveUser.phone);

        const response = await request(app.server)
          .get("/me")
          .set({ Authorization: "Bearer valid-token-inactive-user" });
        const body = response.body as ApiErrorResponse;

        expect(response.status).toBe(403);
        expect(body.error).toBe("Forbidden");
        expect(body.message).toBe("User account is inactive");
      } finally {
        // Cleanup
        await prisma.user.delete({ where: { id: inactiveUser.id } });
      }
    });

    // Note: "no branch assigned" test is skipped because branchId is required in schema
    // The auth middleware has a defensive check but the DB constraint prevents this scenario

    it("should lookup user by email if phone is not in token", async () => {
      mockValidTokenWithEmail(TEST_USERS.admin.email);

      const response = await request(app.server)
        .get("/me")
        .set({ Authorization: "Bearer valid-token-email-lookup" });
      const body = response.body as MeResponse;

      expect(response.status).toBe(200);
      expect(body.firstName).toBe(TEST_USERS.admin.firstName);
    });
  });

  // ============================================
  // Successful Authentication Tests
  // ============================================
  describe("Successful authentication", () => {
    it("should return 200 with valid token and active user", async () => {
      mockValidTokenWithPhone(TEST_USERS.admin.phone);

      const response = await request(app.server)
        .get("/me")
        .set({ Authorization: "Bearer valid-token" });

      expect(response.status).toBe(200);
    });

    it("should return correct user info from GET /me", async () => {
      mockValidTokenWithPhone(TEST_USERS.admin.phone);

      const response = await request(app.server)
        .get("/me")
        .set({ Authorization: "Bearer valid-token" });
      const body = response.body as MeResponse;

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        firstName: TEST_USERS.admin.firstName,
        lastName: TEST_USERS.admin.lastName,
        role: TEST_USERS.admin.role,
        name: `${TEST_USERS.admin.firstName} ${TEST_USERS.admin.lastName}`,
      });
      expect(body.id).toBeDefined();
      expect(body.branchId).toBeDefined();
      expect(body.permissions).toBeInstanceOf(Array);
      expect(body.permissions.length).toBeGreaterThan(0);
    });

    it("should return correct permissions for admin role", async () => {
      mockValidTokenWithPhone(TEST_USERS.admin.phone);

      const response = await request(app.server)
        .get("/me")
        .set({ Authorization: "Bearer valid-token" });
      const body = response.body as MeResponse;

      expect(response.status).toBe(200);
      expect(body.role).toBe("admin");
      // Admin should have all permissions
      expect(body.permissions).toContain("STUDENT_VIEW");
      expect(body.permissions).toContain("STUDENT_EDIT");
      expect(body.permissions).toContain("ATTENDANCE_MARK");
      expect(body.permissions).toContain("FEE_VIEW");
      expect(body.permissions).toContain("FEE_UPDATE");
      expect(body.permissions).toContain("USER_MANAGE");
      expect(body.permissions).toContain("SETTINGS_MANAGE");
      expect(body.permissions).toContain("DASHBOARD_VIEW");
    });

    it("should return correct permissions for teacher role", async () => {
      mockValidTokenWithPhone(TEST_USERS.teacher.phone);

      const response = await request(app.server)
        .get("/me")
        .set({ Authorization: "Bearer valid-token" });
      const body = response.body as MeResponse;

      expect(response.status).toBe(200);
      expect(body.role).toBe("teacher");
      // Teacher should have limited permissions
      expect(body.permissions).toContain("STUDENT_VIEW");
      expect(body.permissions).toContain("ATTENDANCE_MARK");
      expect(body.permissions).toContain("DASHBOARD_VIEW");
      // Teacher should NOT have these
      expect(body.permissions).not.toContain("STUDENT_EDIT");
      expect(body.permissions).not.toContain("FEE_UPDATE");
      expect(body.permissions).not.toContain("USER_MANAGE");
    });

    it("should allow authenticated user to access protected routes", async () => {
      mockValidTokenWithPhone(TEST_USERS.admin.phone);

      const response = await request(app.server)
        .get("/api/v1/students")
        .set({ Authorization: "Bearer valid-token" });

      // Should not be 401 (auth worked)
      expect(response.status).not.toBe(401);
      // Should be 200 (admin has STUDENT_VIEW)
      expect(response.status).toBe(200);
    });
  });

  // ============================================
  // Public Routes Tests
  // ============================================
  describe("Public routes", () => {
    it("should allow access to /health without authentication", async () => {
      const response = await request(app.server).get("/health");
      const body = response.body as HealthResponse;

      expect(response.status).toBe(200);
      expect(body.status).toBe("ok");
      // Firebase mock should not be called for public routes
      expect(mockVerifyIdToken).not.toHaveBeenCalled();
    });
  });
});
