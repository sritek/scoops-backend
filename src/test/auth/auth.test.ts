import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, createTestToken, createTokenPayload } from "../helpers.js";
import { prisma } from "../setup.js";
import type { ApiErrorResponse, MeResponse, HealthResponse } from "../types.js";
import { hashPassword } from "../../modules/auth/auth.service.js";

// Known test data - will be populated from seed
let testUsers: {
  admin: { id: string; employeeId: string; orgId: string; branchId: string };
  teacher: { id: string; employeeId: string; orgId: string; branchId: string };
};

describe("Authentication", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();

    // Get test users from database (created by seed)
    const admin = await prisma.user.findFirst({
      where: { email: "admin@abccoaching.com" },
      select: { id: true, employeeId: true, orgId: true, branchId: true },
    });

    const teacher = await prisma.user.findFirst({
      where: { email: "priya@abccoaching.com" },
      select: { id: true, employeeId: true, orgId: true, branchId: true },
    });

    if (!admin || !teacher) {
      throw new Error("Test users not found. Please run seed first.");
    }

    testUsers = {
      admin: { id: admin.id, employeeId: admin.employeeId, orgId: admin.orgId, branchId: admin.branchId },
      teacher: { id: teacher.id, employeeId: teacher.employeeId, orgId: teacher.orgId, branchId: teacher.branchId },
    };
  });

  afterAll(async () => {
    await app.close();
  });

  // ============================================
  // Token Validation Tests
  // ============================================
  describe("Token validation", () => {
    it("should return 401 when Authorization header is missing", async () => {
      const response = await request(app.server).get("/api/v1/auth/me");
      const body = response.body as ApiErrorResponse;

      expect(response.status).toBe(401);
      expect(body.error).toBe("Unauthorized");
      expect(body.message).toBe("Missing authorization token");
    });

    it("should return 401 when Authorization header has wrong format", async () => {
      const response = await request(app.server)
        .get("/api/v1/auth/me")
        .set({ Authorization: "InvalidFormat token123" });
      const body = response.body as ApiErrorResponse;

      expect(response.status).toBe(401);
      expect(body.error).toBe("Unauthorized");
      expect(body.message).toBe("Missing authorization token");
    });

    it("should return 401 when token is invalid", async () => {
      const response = await request(app.server)
        .get("/api/v1/auth/me")
        .set({ Authorization: "Bearer invalid-token" });
      const body = response.body as ApiErrorResponse;

      expect(response.status).toBe(401);
      expect(body.error).toBe("Unauthorized");
      expect(body.message).toBe("Invalid or expired token");
    });
  });

  // ============================================
  // User Validation Tests
  // ============================================
  describe("User validation", () => {
    it("should return 403 when user is not found in database", async () => {
      // Create a valid token but for a non-existent user
      const token = createTestToken(
        createTokenPayload("non-existent-id", "FAKE123", testUsers.admin.orgId, testUsers.admin.branchId, "admin")
      );

      const response = await request(app.server)
        .get("/api/v1/auth/me")
        .set({ Authorization: `Bearer ${token}` });
      const body = response.body as ApiErrorResponse;

      expect(response.status).toBe(403);
      expect(body.error).toBe("Forbidden");
      expect(body.message).toBe("User not found in system");
    });

    it("should return 403 when user is inactive", async () => {
      // Create an inactive user
      const org = await prisma.organization.findFirst();
      const branch = await prisma.branch.findFirst();

      const inactiveUser = await prisma.user.create({
        data: {
          orgId: org!.id,
          branchId: branch!.id,
          employeeId: "INACT01",
          passwordHash: await hashPassword("Password123"),
          mustChangePassword: false,
          firstName: "Inactive",
          lastName: "User",
          phone: "9999888877",
          email: "inactive@test.com",
          role: "staff",
          isActive: false,
        },
      });

      try {
        const token = createTestToken(
          createTokenPayload(inactiveUser.id, inactiveUser.employeeId, inactiveUser.orgId, inactiveUser.branchId, "staff")
        );

        const response = await request(app.server)
          .get("/api/v1/auth/me")
          .set({ Authorization: `Bearer ${token}` });
        const body = response.body as ApiErrorResponse;

        expect(response.status).toBe(403);
        expect(body.error).toBe("Forbidden");
        expect(body.message).toBe("User account is inactive");
      } finally {
        // Cleanup
        await prisma.user.delete({ where: { id: inactiveUser.id } });
      }
    });
  });

  // ============================================
  // Successful Authentication Tests
  // ============================================
  describe("Successful authentication", () => {
    it("should return 200 with valid token and active user", async () => {
      const token = createTestToken(
        createTokenPayload(testUsers.admin.id, testUsers.admin.employeeId, testUsers.admin.orgId, testUsers.admin.branchId, "admin")
      );

      const response = await request(app.server)
        .get("/api/v1/auth/me")
        .set({ Authorization: `Bearer ${token}` });

      expect(response.status).toBe(200);
    });

    it("should return correct user info from GET /auth/me", async () => {
      const token = createTestToken(
        createTokenPayload(testUsers.admin.id, testUsers.admin.employeeId, testUsers.admin.orgId, testUsers.admin.branchId, "admin")
      );

      const response = await request(app.server)
        .get("/api/v1/auth/me")
        .set({ Authorization: `Bearer ${token}` });
      const body = response.body as MeResponse;

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        firstName: "Rajesh",
        lastName: "Kumar",
        role: "admin",
        name: "Rajesh Kumar",
      });
      expect(body.id).toBeDefined();
      expect(body.branchId).toBeDefined();
      expect(body.permissions).toBeInstanceOf(Array);
      expect(body.permissions.length).toBeGreaterThan(0);
    });

    it("should return correct permissions for admin role", async () => {
      const token = createTestToken(
        createTokenPayload(testUsers.admin.id, testUsers.admin.employeeId, testUsers.admin.orgId, testUsers.admin.branchId, "admin")
      );

      const response = await request(app.server)
        .get("/api/v1/auth/me")
        .set({ Authorization: `Bearer ${token}` });
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
      const token = createTestToken(
        createTokenPayload(testUsers.teacher.id, testUsers.teacher.employeeId, testUsers.teacher.orgId, testUsers.teacher.branchId, "teacher")
      );

      const response = await request(app.server)
        .get("/api/v1/auth/me")
        .set({ Authorization: `Bearer ${token}` });
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
      const token = createTestToken(
        createTokenPayload(testUsers.admin.id, testUsers.admin.employeeId, testUsers.admin.orgId, testUsers.admin.branchId, "admin")
      );

      const response = await request(app.server)
        .get("/api/v1/students")
        .set({ Authorization: `Bearer ${token}` });

      // Should not be 401 (auth worked)
      expect(response.status).not.toBe(401);
      // Should be 200 (admin has STUDENT_VIEW)
      expect(response.status).toBe(200);
    });
  });

  // ============================================
  // Login Tests
  // ============================================
  describe("Login endpoint", () => {
    it("should login successfully with valid credentials", async () => {
      // Find an admin user with known credentials
      const admin = await prisma.user.findFirst({
        where: { email: "admin@abccoaching.com" },
      });

      // Update password to a known value for testing
      await prisma.user.update({
        where: { id: admin!.id },
        data: { passwordHash: await hashPassword("TestPassword123") },
      });

      const response = await request(app.server)
        .post("/api/v1/auth/login")
        .send({
          employeeId: admin!.employeeId,
          password: "TestPassword123",
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.employeeId).toBe(admin!.employeeId);
    });

    it("should return 401 with invalid password", async () => {
      const admin = await prisma.user.findFirst({
        where: { email: "admin@abccoaching.com" },
      });

      const response = await request(app.server)
        .post("/api/v1/auth/login")
        .send({
          employeeId: admin!.employeeId,
          password: "WrongPassword123",
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Unauthorized");
    });

    it("should return 401 with non-existent employee ID", async () => {
      const response = await request(app.server)
        .post("/api/v1/auth/login")
        .send({
          employeeId: "NOTEXIST",
          password: "Password123",
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Unauthorized");
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
    });

    it("should allow access to /auth/login without authentication", async () => {
      const response = await request(app.server)
        .post("/api/v1/auth/login")
        .send({
          employeeId: "test",
          password: "test",
        });

      // Should get 401 (invalid credentials) not 401 (missing token)
      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid employee ID or password");
    });
  });
});
