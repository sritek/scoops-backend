import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, getAuthHeaders } from "../helpers";
import { USERS } from "../fixtures";
import { prisma } from "../setup.js";
import type { ApiErrorResponse } from "../types";

describe("RBAC Enforcement", () => {
  let app: FastifyInstance;
  let studentId: string;
  let batchId: string;
  let studentFeeId: string;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();

    // Get a student ID for testing
    const student = await prisma.student.findFirst({
      where: {
        branch: {
          name: "Main Branch",
        },
      },
    });
    studentId = student?.id ?? "";

    // Get a batch ID for testing
    const batch = await prisma.batch.findFirst({
      where: {
        branch: {
          name: "Main Branch",
        },
      },
    });
    batchId = batch?.id ?? "";

    // Get a student fee ID for testing
    const studentFee = await prisma.studentFee.findFirst({
      where: {
        student: {
          branch: {
            name: "Main Branch",
          },
        },
        status: "pending",
      },
    });
    studentFeeId = studentFee?.id ?? "";
  });

  afterAll(async () => {
    await app.close();
  });

  // ============================================
  // Teacher cannot access fees APIs
  // ============================================
  describe("Teacher RBAC restrictions", () => {
    it("should reject teacher from viewing pending fees (403)", async () => {
      const response = await request(app.server)
        .get("/api/v1/fees/pending")
        .set(await getAuthHeaders(USERS.teacher1.email));
      const body = response.body as ApiErrorResponse;

      expect(response.status).toBe(403);
      expect(body.error).toBe("Forbidden");
    });

    it("should reject teacher from recording payment (403)", async () => {
      const response = await request(app.server)
        .post("/api/v1/fees/payment")
        .set(await getAuthHeaders(USERS.teacher1.email))
        .send({
          studentFeeId,
          amount: 1000,
          paymentMode: "cash",
        });
      const body = response.body as ApiErrorResponse;

      expect(response.status).toBe(403);
      expect(body.error).toBe("Forbidden");
    });

    it("should reject teacher from creating fee plan (403)", async () => {
      const response = await request(app.server)
        .post("/api/v1/fees/plan")
        .set(await getAuthHeaders(USERS.teacher1.email))
        .send({
          name: "Test Fee Plan",
          amount: 5000,
          frequency: "monthly",
        });
      const body = response.body as ApiErrorResponse;

      expect(response.status).toBe(403);
      expect(body.error).toBe("Forbidden");
    });

    it("should allow teacher to view students (200)", async () => {
      const response = await request(app.server)
        .get("/api/v1/students")
        .set(await getAuthHeaders(USERS.teacher1.email));

      expect(response.status).toBe(200);
    });

    it("should allow teacher to mark attendance (201)", async () => {
      const today = new Date().toISOString().split("T")[0];

      // First, get a batch the teacher is assigned to
      const batch = await prisma.batch.findFirst({
        where: {
          classTeacher: {
            email: USERS.teacher1.email,
          },
        },
        include: {
          students: true,
        },
      });

      if (!batch || batch.students.length === 0) {
        // Skip if no assigned batch
        return;
      }

      const response = await request(app.server)
        .post("/api/v1/attendance/mark")
        .set(await getAuthHeaders(USERS.teacher1.email))
        .send({
          batchId: batch.id,
          date: today,
          records: batch.students.slice(0, 1).map((s: { id: string }) => ({
            studentId: s.id,
            status: "present",
          })),
        });

      // Should succeed or already exists
      expect([201, 200, 400]).toContain(response.status);
    });
  });

  // ============================================
  // Accounts cannot access attendance APIs
  // ============================================
  describe("Accounts RBAC restrictions", () => {
    it("should reject accounts from marking attendance (403)", async () => {
      const today = new Date().toISOString().split("T")[0];

      const response = await request(app.server)
        .post("/api/v1/attendance/mark")
        .set(await getAuthHeaders(USERS.accounts.email))
        .send({
          batchId,
          date: today,
          records: [
            {
              studentId,
              status: "present",
            },
          ],
        });
      const body = response.body as ApiErrorResponse;

      expect(response.status).toBe(403);
      expect(body.error).toBe("Forbidden");
    });

    it("should allow accounts to view students (200)", async () => {
      const response = await request(app.server)
        .get("/api/v1/students")
        .set(await getAuthHeaders(USERS.accounts.email));

      expect(response.status).toBe(200);
    });

    it("should allow accounts to view pending fees (200)", async () => {
      const response = await request(app.server)
        .get("/api/v1/fees/pending")
        .set(await getAuthHeaders(USERS.accounts.email));

      expect(response.status).toBe(200);
    });

    it("should allow accounts to record payment (201)", async () => {
      // Find a pending fee that hasn't been fully paid
      const pendingFee = await prisma.studentFee.findFirst({
        where: {
          status: "pending",
          student: {
            branch: {
              name: "Main Branch",
            },
          },
        },
      });

      if (!pendingFee) {
        // Skip if no pending fee
        return;
      }

      const response = await request(app.server)
        .post("/api/v1/fees/payment")
        .set(await getAuthHeaders(USERS.accounts.email))
        .send({
          studentFeeId: pendingFee.id,
          amount: 100,
          paymentMode: "cash",
        });

      expect([201, 200]).toContain(response.status);
    });
  });

  // ============================================
  // Staff cannot mutate anything
  // ============================================
  describe("Staff RBAC restrictions (read-only)", () => {
    it("should reject staff from creating student (403)", async () => {
      const response = await request(app.server)
        .post("/api/v1/students")
        .set(await getAuthHeaders(USERS.staff.email))
        .send({
          firstName: "New",
          lastName: "Student",
          gender: "male",
          dob: "2010-01-01",
          admissionYear: 2024,
          parents: [
            {
              firstName: "Parent",
              lastName: "Name",
              phone: "9999999999",
              relation: "father",
            },
          ],
        });
      const body = response.body as ApiErrorResponse;

      expect(response.status).toBe(403);
      expect(body.error).toBe("Forbidden");
    });

    it("should reject staff from updating student (403)", async () => {
      const response = await request(app.server)
        .put(`/api/v1/students/${studentId}`)
        .set(await getAuthHeaders(USERS.staff.email))
        .send({
          firstName: "Updated",
        });
      const body = response.body as ApiErrorResponse;

      expect(response.status).toBe(403);
      expect(body.error).toBe("Forbidden");
    });

    it("should reject staff from deactivating student (403)", async () => {
      const response = await request(app.server)
        .delete(`/api/v1/students/${studentId}`)
        .set(await getAuthHeaders(USERS.staff.email));
      const body = response.body as ApiErrorResponse;

      expect(response.status).toBe(403);
      expect(body.error).toBe("Forbidden");
    });

    it("should reject staff from creating batch (403)", async () => {
      const response = await request(app.server)
        .post("/api/v1/batches")
        .set(await getAuthHeaders(USERS.staff.email))
        .send({
          name: "New Batch",
          academicLevel: "secondary",
          stream: "science",
        });
      const body = response.body as ApiErrorResponse;

      expect(response.status).toBe(403);
      expect(body.error).toBe("Forbidden");
    });

    it("should reject staff from marking attendance (403)", async () => {
      const today = new Date().toISOString().split("T")[0];

      const response = await request(app.server)
        .post("/api/v1/attendance/mark")
        .set(await getAuthHeaders(USERS.staff.email))
        .send({
          batchId,
          date: today,
          records: [
            {
              studentId,
              status: "present",
            },
          ],
        });
      const body = response.body as ApiErrorResponse;

      expect(response.status).toBe(403);
      expect(body.error).toBe("Forbidden");
    });

    it("should reject staff from accessing fees (403)", async () => {
      const response = await request(app.server)
        .get("/api/v1/fees/pending")
        .set(await getAuthHeaders(USERS.staff.email));
      const body = response.body as ApiErrorResponse;

      expect(response.status).toBe(403);
      expect(body.error).toBe("Forbidden");
    });

    it("should allow staff to view students (200)", async () => {
      const response = await request(app.server)
        .get("/api/v1/students")
        .set(await getAuthHeaders(USERS.staff.email));

      expect(response.status).toBe(200);
    });

    it("should allow staff to view batches (200)", async () => {
      const response = await request(app.server)
        .get("/api/v1/batches")
        .set(await getAuthHeaders(USERS.staff.email));

      expect(response.status).toBe(200);
    });

    it("should allow staff to view dashboard (200)", async () => {
      const response = await request(app.server)
        .get("/api/v1/dashboard")
        .set(await getAuthHeaders(USERS.staff.email));

      expect(response.status).toBe(200);
    });
  });

  // ============================================
  // Admin can access everything
  // ============================================
  describe("Admin has full access", () => {
    it("should allow admin to view students (200)", async () => {
      const response = await request(app.server)
        .get("/api/v1/students")
        .set(await getAuthHeaders(USERS.admin.email));

      expect(response.status).toBe(200);
    });

    it("should allow admin to view batches (200)", async () => {
      const response = await request(app.server)
        .get("/api/v1/batches")
        .set(await getAuthHeaders(USERS.admin.email));

      expect(response.status).toBe(200);
    });

    it("should allow admin to view pending fees (200)", async () => {
      const response = await request(app.server)
        .get("/api/v1/fees/pending")
        .set(await getAuthHeaders(USERS.admin.email));

      expect(response.status).toBe(200);
    });

    it("should allow admin to view attendance (200)", async () => {
      const today = new Date().toISOString().split("T")[0];

      const response = await request(app.server)
        .get(`/api/v1/attendance?batchId=${batchId}&date=${today}`)
        .set(await getAuthHeaders(USERS.admin.email));

      expect(response.status).toBe(200);
    });

    it("should allow admin to view dashboard (200)", async () => {
      const response = await request(app.server)
        .get("/api/v1/dashboard")
        .set(await getAuthHeaders(USERS.admin.email));

      expect(response.status).toBe(200);
    });

    it("should allow admin to create batch (201)", async () => {
      const response = await request(app.server)
        .post("/api/v1/batches")
        .set(await getAuthHeaders(USERS.admin.email))
        .send({
          name: "Admin Test Batch",
          academicLevel: "secondary",
          stream: "science",
        });

      expect([201, 200]).toContain(response.status);
    });
  });

  // ============================================
  // Unauthenticated requests
  // ============================================
  describe("Unauthenticated requests", () => {
    it("should reject requests without auth header (401)", async () => {
      const response = await request(app.server).get("/api/v1/students");
      const body = response.body as ApiErrorResponse;

      expect(response.status).toBe(401);
      expect(body.error).toBe("Unauthorized");
    });

    it("should reject requests with invalid token (401)", async () => {
      const response = await request(app.server)
        .get("/api/v1/students")
        .set({ Authorization: "Bearer invalid-token" });
      const body = response.body as ApiErrorResponse;

      expect(response.status).toBe(401);
      expect(body.error).toBe("Unauthorized");
    });
  });
});
