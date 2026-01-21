import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, getAuthHeaders } from "../helpers";
import { USERS } from "../fixtures";
import { prisma } from "../setup.js";
import type { StudentResponse, BatchResponse, DashboardResponse } from "../types";

describe("Happy Path Flows", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ============================================
  // Admin creates student
  // ============================================
  describe("Admin creates student flow", () => {
    let createdStudentId: string;

    it("should create a new student with parent (201)", async () => {
      const response = await request(app.server)
        .post("/api/v1/students")
        .set(await getAuthHeaders(USERS.admin.email))
        .send({
          firstName: "Flow",
          lastName: "TestStudent",
          gender: "male",
          dob: "2010-06-15",
          admissionYear: 2024,
          parents: [
            {
              firstName: "Flow",
              lastName: "TestParent",
              phone: "9888888881",
              relation: "father",
            },
          ],
        });
      const body = response.body as StudentResponse;

      expect(response.status).toBe(201);
      expect(body).toHaveProperty("id");
      expect(body.firstName).toBe("Flow");
      expect(body.lastName).toBe("TestStudent");

      createdStudentId = body.id;
    });

    it("should verify student exists in database", async () => {
      const student = await prisma.student.findUnique({
        where: { id: createdStudentId },
        include: {
          studentParents: {
            include: {
              parent: true,
            },
          },
        },
      });

      expect(student).not.toBeNull();
      expect(student?.firstName).toBe("Flow");
      expect(student?.lastName).toBe("TestStudent");
      expect(student?.studentParents).toHaveLength(1);
      expect(student?.studentParents[0].parent.phone).toBe("9888888881");
    });

    it("should be able to retrieve the created student (200)", async () => {
      const response = await request(app.server)
        .get(`/api/v1/students/${createdStudentId}`)
        .set(await getAuthHeaders(USERS.admin.email));
      const body = response.body as StudentResponse;

      expect(response.status).toBe(200);
      expect(body.id).toBe(createdStudentId);
    });
  });

  // ============================================
  // Teacher marks attendance
  // ============================================
  describe("Teacher marks attendance flow", () => {
    let teacherBatchId: string;
    let teacherStudentIds: string[];
    let attendanceSessionId: string;

    beforeAll(async () => {
      // Get a batch assigned to teacher1
      const batch = await prisma.batch.findFirst({
        where: {
          classTeacher: {
            email: USERS.teacher1.email,
          },
        },
        include: {
          students: {
            take: 3,
          },
        },
      });

      teacherBatchId = batch?.id ?? "";
      teacherStudentIds = batch?.students.map((s: { id: string }) => s.id) ?? [];
    });

    it("should mark attendance for assigned batch (201)", async () => {
      if (!teacherBatchId || teacherStudentIds.length === 0) {
        // Skip if no batch/students
        return;
      }

      // Use tomorrow to avoid conflict with existing attendance
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split("T")[0];

      const response = await request(app.server)
        .post("/api/v1/attendance/mark")
        .set(await getAuthHeaders(USERS.teacher1.email))
        .send({
          batchId: teacherBatchId,
          date: dateStr,
          records: teacherStudentIds.map((studentId, index) => ({
            studentId,
            status: index === 0 ? "absent" : "present",
          })),
        });

      expect([201, 200]).toContain(response.status);

      const body = response.body as { session?: { id: string } };
      if (body.session?.id) {
        attendanceSessionId = body.session.id;
      }
    });

    it("should verify attendance records in database", async () => {
      if (!attendanceSessionId) {
        // Skip if no session created
        return;
      }

      const session = await prisma.attendanceSession.findUnique({
        where: { id: attendanceSessionId },
        include: {
          records: true,
        },
      });

      expect(session).not.toBeNull();
      expect(session?.records).toHaveLength(teacherStudentIds.length);
    });

    it("should verify attendance.marked event was created", async () => {
      if (!attendanceSessionId) {
        return;
      }

      // Find event created for this attendance (payload is JSON string)
      const event = await prisma.event.findFirst({
        where: {
          type: "attendance_marked",
          payload: {
            contains: attendanceSessionId,
          },
        },
      });

      // Event should exist
      expect(event).not.toBeNull();
    });

    it("should verify student.absent event was created for absent student", async () => {
      if (!attendanceSessionId || teacherStudentIds.length === 0) {
        return;
      }

      // Find absent event for the first student (marked absent, payload is JSON string)
      const event = await prisma.event.findFirst({
        where: {
          type: "student_absent",
          payload: {
            contains: teacherStudentIds[0],
          },
        },
      });

      // Event should exist for absent student
      expect(event).not.toBeNull();
    });
  });

  // ============================================
  // Accounts records payment
  // ============================================
  describe("Accounts records payment flow", () => {
    let pendingFeeId: string;
    let initialPaidAmount: number;
    let paymentAmount: number;

    beforeAll(async () => {
      // Find a pending fee to pay
      const fee = await prisma.studentFee.findFirst({
        where: {
          status: "pending",
          student: {
            branch: {
              name: "Main Branch",
            },
          },
        },
      });

      pendingFeeId = fee?.id ?? "";
      initialPaidAmount = fee?.paidAmount ?? 0;
      paymentAmount = 500; // Pay 500
    });

    it("should record a payment (201)", async () => {
      if (!pendingFeeId) {
        return;
      }

      const response = await request(app.server)
        .post("/api/v1/fees/payment")
        .set(await getAuthHeaders(USERS.accounts.email))
        .send({
          studentFeeId: pendingFeeId,
          amount: paymentAmount,
          paymentMode: "cash",
        });

      expect([201, 200]).toContain(response.status);
    });

    it("should verify paid_amount updated in database", async () => {
      if (!pendingFeeId) {
        return;
      }

      const fee = await prisma.studentFee.findUnique({
        where: { id: pendingFeeId },
      });

      expect(fee).not.toBeNull();
      expect(fee?.paidAmount).toBe(initialPaidAmount + paymentAmount);
    });

    it("should verify fee_paid event was created", async () => {
      if (!pendingFeeId) {
        return;
      }

      // Find fee_paid event (payload is JSON string)
      const event = await prisma.event.findFirst({
        where: {
          type: "fee_paid",
          payload: {
            contains: pendingFeeId,
          },
        },
      });

      expect(event).not.toBeNull();
    });

    it("should verify payment record exists", async () => {
      if (!pendingFeeId) {
        return;
      }

      const payment = await prisma.feePayment.findFirst({
        where: {
          studentFeeId: pendingFeeId,
          amount: paymentAmount,
        },
      });

      expect(payment).not.toBeNull();
      expect(payment?.paymentMode).toBe("cash");
    });
  });

  // ============================================
  // Full fee payment flow
  // ============================================
  describe("Full fee payment flow (status change)", () => {
    let testFeeId: string;
    let totalAmount: number;

    beforeAll(async () => {
      // Create a new fee for testing full payment
      const student = await prisma.student.findFirst({
        where: {
          branch: {
            name: "Main Branch",
          },
        },
      });

      // Get branch ID first
      const mainBranch = await prisma.branch.findFirst({
        where: { name: "Main Branch" },
      });

      const feePlan = await prisma.feePlan.findFirst({
        where: {
          branchId: mainBranch?.id,
        },
      });

      if (student && feePlan) {
        const fee = await prisma.studentFee.create({
          data: {
            studentId: student.id,
            feePlanId: feePlan.id,
            totalAmount: 1000,
            paidAmount: 0,
            dueDate: new Date(),
            status: "pending",
          },
        });
        testFeeId = fee.id;
        totalAmount = fee.totalAmount;
      }
    });

    it("should change status to paid when fully paid", async () => {
      if (!testFeeId) {
        return;
      }

      // Pay the full amount
      const response = await request(app.server)
        .post("/api/v1/fees/payment")
        .set(await getAuthHeaders(USERS.accounts.email))
        .send({
          studentFeeId: testFeeId,
          amount: totalAmount,
          paymentMode: "upi",
        });

      expect([201, 200]).toContain(response.status);

      // Verify status changed to paid
      const fee = await prisma.studentFee.findUnique({
        where: { id: testFeeId },
      });

      expect(fee?.status).toBe("paid");
      expect(fee?.paidAmount).toBe(totalAmount);
    });
  });

  // ============================================
  // Admin creates batch flow
  // ============================================
  describe("Admin creates batch flow", () => {
    let createdBatchId: string;

    it("should create a new batch (201)", async () => {
      const response = await request(app.server)
        .post("/api/v1/batches")
        .set(await getAuthHeaders(USERS.admin.email))
        .send({
          name: "Flow Test Batch",
          academicLevel: "middle",
          stream: "general",
        });
      const body = response.body as BatchResponse;

      expect(response.status).toBe(201);
      expect(body).toHaveProperty("id");
      expect(body.name).toBe("Flow Test Batch");

      createdBatchId = body.id;
    });

    it("should verify batch exists in database", async () => {
      const batch = await prisma.batch.findUnique({
        where: { id: createdBatchId },
      });

      expect(batch).not.toBeNull();
      expect(batch?.name).toBe("Flow Test Batch");
      expect(batch?.academicLevel).toBe("middle");
    });

    it("should assign teacher to batch (200)", async () => {
      // Get teacher ID
      const teacher = await prisma.user.findFirst({
        where: {
          email: USERS.teacher1.email,
        },
      });

      const response = await request(app.server)
        .put(`/api/v1/batches/${createdBatchId}`)
        .set(await getAuthHeaders(USERS.admin.email))
        .send({
          classTeacherId: teacher?.id,
        });

      expect(response.status).toBe(200);

      // Verify teacher assigned
      const batch = await prisma.batch.findUnique({
        where: { id: createdBatchId },
      });

      expect(batch?.classTeacherId).toBe(teacher?.id);
    });
  });

  // ============================================
  // View attendance flow
  // ============================================
  describe("View attendance flow", () => {
    it("should return attendance for a batch", async () => {
      const batch = await prisma.batch.findFirst({
        where: {
          branch: {
            name: "Main Branch",
          },
        },
      });

      const today = new Date().toISOString().split("T")[0];

      const response = await request(app.server)
        .get(`/api/v1/attendance?batchId=${batch?.id}&date=${today}`)
        .set(await getAuthHeaders(USERS.admin.email));

      expect(response.status).toBe(200);
    });
  });

  // ============================================
  // Dashboard summary flow
  // ============================================
  describe("Dashboard summary flow", () => {
    it("should return dashboard summary", async () => {
      const response = await request(app.server)
        .get("/api/v1/dashboard")
        .set(await getAuthHeaders(USERS.admin.email));
      const body = response.body as DashboardResponse;

      expect(response.status).toBe(200);
      expect(body).toHaveProperty("attendance");
      expect(body).toHaveProperty("pendingFees");
    });
  });
});
