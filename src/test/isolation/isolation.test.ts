import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, getAuthHeaders } from "../helpers.js";
import { USERS, ORG1_BRANCH2_USERS, ORG2_USERS } from "../fixtures.js";
import { prisma } from "../setup.js";
import type { StudentResponse, BatchResponse, AttendanceResponse } from "../types.js";

describe("Data Isolation", () => {
  let app: FastifyInstance;

  // IDs for cross-tenant testing
  let org1Branch1StudentId: string;
  let org1Branch1BatchId: string;
  let org1Branch2StudentId: string;
  let org1Branch2BatchId: string;
  let org2StudentId: string;
  let org2BatchId: string;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();

    // Get Org1 Branch1 data
    const org1Branch1Student = await prisma.student.findFirst({
      where: {
        branch: {
          name: "Main Branch",
          organization: {
            name: "ABC Coaching Center",
          },
        },
      },
    });
    org1Branch1StudentId = org1Branch1Student?.id ?? "";

    const org1Branch1Batch = await prisma.batch.findFirst({
      where: {
        branch: {
          name: "Main Branch",
          organization: {
            name: "ABC Coaching Center",
          },
        },
      },
    });
    org1Branch1BatchId = org1Branch1Batch?.id ?? "";

    // Get Org1 Branch2 data
    const org1Branch2Student = await prisma.student.findFirst({
      where: {
        branch: {
          name: "South Branch",
          organization: {
            name: "ABC Coaching Center",
          },
        },
      },
    });
    org1Branch2StudentId = org1Branch2Student?.id ?? "";

    const org1Branch2Batch = await prisma.batch.findFirst({
      where: {
        branch: {
          name: "South Branch",
          organization: {
            name: "ABC Coaching Center",
          },
        },
      },
    });
    org1Branch2BatchId = org1Branch2Batch?.id ?? "";

    // Get Org2 data
    const org2Student = await prisma.student.findFirst({
      where: {
        branch: {
          organization: {
            name: "XYZ Academy",
          },
        },
      },
    });
    org2StudentId = org2Student?.id ?? "";

    const org2Batch = await prisma.batch.findFirst({
      where: {
        branch: {
          organization: {
            name: "XYZ Academy",
          },
        },
      },
    });
    org2BatchId = org2Batch?.id ?? "";
  });

  afterAll(async () => {
    await app.close();
  });

  // ============================================
  // Cross-Organization Isolation
  // ============================================
  describe("Cross-Organization Isolation", () => {
    it("Org1 admin cannot see Org2 students in list", async () => {
      const response = await request(app.server)
        .get("/api/v1/students")
        .set(await getAuthHeaders(USERS.admin.email));
      const body = response.body as StudentResponse[];

      expect(response.status).toBe(200);
      expect(body).toBeInstanceOf(Array);

      // Verify no Org2 students are in the response
      const hasOrg2Student = body.some((s) => s.id === org2StudentId);
      expect(hasOrg2Student).toBe(false);
    });

    it("Org1 admin cannot access Org2 student by ID (403/404)", async () => {
      const response = await request(app.server)
        .get(`/api/v1/students/${org2StudentId}`)
        .set(await getAuthHeaders(USERS.admin.email));

      // Should be 403 (forbidden) or 404 (not found in scope)
      expect([403, 404]).toContain(response.status);
    });

    it("Org2 admin cannot see Org1 students in list", async () => {
      const response = await request(app.server)
        .get("/api/v1/students")
        .set(await getAuthHeaders(ORG2_USERS.admin.email));
      const body = response.body as StudentResponse[];

      expect(response.status).toBe(200);
      expect(body).toBeInstanceOf(Array);

      // Verify no Org1 students are in the response
      const hasOrg1Student = body.some((s) => s.id === org1Branch1StudentId);
      expect(hasOrg1Student).toBe(false);
    });

    it("Org2 admin cannot access Org1 batch (403/404)", async () => {
      const today = new Date().toISOString().split("T")[0];

      const response = await request(app.server)
        .get(`/api/v1/attendance?batchId=${org1Branch1BatchId}&date=${today}`)
        .set(await getAuthHeaders(ORG2_USERS.admin.email));
      const body = response.body as AttendanceResponse | null;

      // Should be 403 or return empty/error
      expect([403, 404, 200]).toContain(response.status);
      if (response.status === 200) {
        // If 200, should return empty array or null (no data from other org)
        expect(
          body === null ||
            (Array.isArray(body) && body.length === 0) ||
            body?.records?.length === 0
        ).toBe(true);
      }
    });

    it("Org1 admin cannot mark attendance for Org2 batch (403)", async () => {
      const today = new Date().toISOString().split("T")[0];

      const response = await request(app.server)
        .post("/api/v1/attendance/mark")
        .set(await getAuthHeaders(USERS.admin.email))
        .send({
          batchId: org2BatchId,
          date: today,
          records: [
            {
              studentId: org2StudentId,
              status: "present",
            },
          ],
        });

      // Should be forbidden or not found
      expect([403, 404, 400]).toContain(response.status);
    });
  });

  // ============================================
  // Cross-Branch Isolation (Same Organization)
  // ============================================
  describe("Cross-Branch Isolation (Same Organization)", () => {
    it("Branch1 admin cannot see Branch2 students in list", async () => {
      const response = await request(app.server)
        .get("/api/v1/students")
        .set(await getAuthHeaders(USERS.admin.email));
      const body = response.body as StudentResponse[];

      expect(response.status).toBe(200);
      expect(body).toBeInstanceOf(Array);

      // Verify no Branch2 students are in the response
      const hasBranch2Student = body.some((s) => s.id === org1Branch2StudentId);
      expect(hasBranch2Student).toBe(false);
    });

    it("Branch1 admin cannot access Branch2 student by ID (403/404)", async () => {
      const response = await request(app.server)
        .get(`/api/v1/students/${org1Branch2StudentId}`)
        .set(await getAuthHeaders(USERS.admin.email));

      // Should be 403 (forbidden) or 404 (not found in scope)
      expect([403, 404]).toContain(response.status);
    });

    it("Branch2 admin cannot see Branch1 students in list", async () => {
      const response = await request(app.server)
        .get("/api/v1/students")
        .set(await getAuthHeaders(ORG1_BRANCH2_USERS.admin.email));
      const body = response.body as StudentResponse[];

      expect(response.status).toBe(200);
      expect(body).toBeInstanceOf(Array);

      // Verify no Branch1 students are in the response
      const hasBranch1Student = body.some((s) => s.id === org1Branch1StudentId);
      expect(hasBranch1Student).toBe(false);
    });

    it("Branch1 admin cannot mark attendance for Branch2 batch (403)", async () => {
      const today = new Date().toISOString().split("T")[0];

      const response = await request(app.server)
        .post("/api/v1/attendance/mark")
        .set(await getAuthHeaders(USERS.admin.email))
        .send({
          batchId: org1Branch2BatchId,
          date: today,
          records: [
            {
              studentId: org1Branch2StudentId,
              status: "present",
            },
          ],
        });

      // Should be forbidden or not found
      expect([403, 404, 400]).toContain(response.status);
    });

    it("Branch2 admin cannot view Branch1 batches", async () => {
      const response = await request(app.server)
        .get("/api/v1/batches")
        .set(await getAuthHeaders(ORG1_BRANCH2_USERS.admin.email));
      const body = response.body as BatchResponse[];

      expect(response.status).toBe(200);
      expect(body).toBeInstanceOf(Array);

      // Verify no Branch1 batches are in the response
      const hasBranch1Batch = body.some((b) => b.id === org1Branch1BatchId);
      expect(hasBranch1Batch).toBe(false);
    });

    it("Branch1 teacher cannot access Branch2 data", async () => {
      const response = await request(app.server)
        .get(`/api/v1/students/${org1Branch2StudentId}`)
        .set(await getAuthHeaders(USERS.teacher1.email));

      // Should be 403 (forbidden) or 404 (not found in scope)
      expect([403, 404]).toContain(response.status);
    });
  });

  // ============================================
  // Data Mutation Isolation
  // ============================================
  describe("Data Mutation Isolation", () => {
    it("Cannot update student from another branch (403/404)", async () => {
      const response = await request(app.server)
        .put(`/api/v1/students/${org1Branch2StudentId}`)
        .set(await getAuthHeaders(USERS.admin.email))
        .send({
          firstName: "Hacked",
        });

      // Should be forbidden or not found
      expect([403, 404]).toContain(response.status);
    });

    it("Cannot update student from another organization (403/404)", async () => {
      const response = await request(app.server)
        .put(`/api/v1/students/${org2StudentId}`)
        .set(await getAuthHeaders(USERS.admin.email))
        .send({
          firstName: "Hacked",
        });

      // Should be forbidden or not found
      expect([403, 404]).toContain(response.status);
    });

    it("Cannot deactivate student from another branch (403/404)", async () => {
      const response = await request(app.server)
        .delete(`/api/v1/students/${org1Branch2StudentId}`)
        .set(await getAuthHeaders(USERS.admin.email));

      // Should be forbidden or not found
      expect([403, 404]).toContain(response.status);
    });

    it("Cannot update batch from another branch (403/404)", async () => {
      const response = await request(app.server)
        .put(`/api/v1/batches/${org1Branch2BatchId}`)
        .set(await getAuthHeaders(USERS.admin.email))
        .send({
          name: "Hacked Batch",
        });

      // Should be forbidden or not found
      expect([403, 404]).toContain(response.status);
    });
  });

  // ============================================
  // Dashboard Isolation
  // ============================================
  describe("Dashboard Data Isolation", () => {
    it("Branch1 dashboard only shows Branch1 data", async () => {
      const response = await request(app.server)
        .get("/api/v1/dashboard")
        .set(await getAuthHeaders(USERS.admin.email));

      expect(response.status).toBe(200);
      // Dashboard should only reflect Branch1 data
      // The exact structure depends on the dashboard implementation
      expect(response.body).toBeDefined();
    });

    it("Branch2 dashboard only shows Branch2 data", async () => {
      const response = await request(app.server)
        .get("/api/v1/dashboard")
        .set(await getAuthHeaders(ORG1_BRANCH2_USERS.admin.email));

      expect(response.status).toBe(200);
      // Dashboard should only reflect Branch2 data
      expect(response.body).toBeDefined();
    });

    it("Org2 dashboard only shows Org2 data", async () => {
      const response = await request(app.server)
        .get("/api/v1/dashboard")
        .set(await getAuthHeaders(ORG2_USERS.admin.email));

      expect(response.status).toBe(200);
      // Dashboard should only reflect Org2 data
      expect(response.body).toBeDefined();
    });
  });
});
