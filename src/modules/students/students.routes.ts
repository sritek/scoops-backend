import type { FastifyInstance } from "fastify";
import { branchContextMiddleware } from "../../middleware/branch.middleware.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions.js";
import * as controller from "./students.controller.js";

/**
 * Students module routes
 * All routes require authentication (applied globally) and branch context
 */
export async function studentsRoutes(app: FastifyInstance) {
  /**
   * GET /students
   * List all students in the branch
   * Requires: STUDENT_VIEW
   */
  app.get(
    "/",
    {
      schema: {
        tags: ["Students"],
        summary: "List all students",
        description: "Returns all students in the current branch with their parents",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_VIEW),
      ],
    },
    controller.listStudents
  );

  /**
   * GET /students/:id
   * Get a single student by ID
   * Requires: STUDENT_VIEW
   */
  app.get(
    "/:id",
    {
      schema: {
        tags: ["Students"],
        summary: "Get student by ID",
        description: "Returns a single student with their parents",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", description: "Student ID" },
          },
          required: ["id"],
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_VIEW),
      ],
    },
    controller.getStudent
  );

  /**
   * POST /students
   * Create a new student
   * Requires: STUDENT_EDIT
   */
  app.post(
    "/",
    {
      schema: {
        tags: ["Students"],
        summary: "Create a new student",
        description: "Creates a new student with optional parent information",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["firstName", "lastName", "admissionYear"],
          properties: {
            firstName: { type: "string", minLength: 1, maxLength: 255 },
            lastName: { type: "string", minLength: 1, maxLength: 255 },
            gender: { type: "string", enum: ["male", "female", "other"] },
            dob: { type: "string", format: "date-time" },
            category: { type: "string", enum: ["gen", "sc", "st", "obc", "minority"] },
            isCwsn: { type: "boolean", default: false },
            admissionYear: { type: "integer", minimum: 2000, maximum: 2100 },
            batchId: { type: "string", format: "uuid" },
            parents: {
              type: "array",
              items: {
                type: "object",
                required: ["firstName", "lastName", "phone", "relation"],
                properties: {
                  firstName: { type: "string" },
                  lastName: { type: "string" },
                  phone: { type: "string", minLength: 10, maxLength: 15 },
                  relation: { type: "string", enum: ["father", "mother", "guardian", "other"] },
                },
              },
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_EDIT),
      ],
    },
    controller.createStudent
  );

  /**
   * PUT /students/:id
   * Update an existing student
   * Requires: STUDENT_EDIT
   */
  app.put(
    "/:id",
    {
      schema: {
        tags: ["Students"],
        summary: "Update a student",
        description: "Updates an existing student's information",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", description: "Student ID" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            firstName: { type: "string", minLength: 1, maxLength: 255 },
            lastName: { type: "string", minLength: 1, maxLength: 255 },
            gender: { type: "string", enum: ["male", "female", "other"] },
            dob: { type: "string", format: "date-time" },
            category: { type: "string", enum: ["gen", "sc", "st", "obc", "minority"] },
            isCwsn: { type: "boolean" },
            admissionYear: { type: "integer", minimum: 2000, maximum: 2100 },
            batchId: { type: "string", format: "uuid", nullable: true },
            status: { type: "string", enum: ["active", "inactive"] },
            parents: {
              type: "array",
              items: {
                type: "object",
                required: ["firstName", "lastName", "phone", "relation"],
                properties: {
                  firstName: { type: "string" },
                  lastName: { type: "string" },
                  phone: { type: "string", minLength: 10, maxLength: 15 },
                  relation: { type: "string", enum: ["father", "mother", "guardian", "other"] },
                },
              },
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_EDIT),
      ],
    },
    controller.updateStudent
  );

  /**
   * DELETE /students/:id
   * Soft delete (deactivate) a student
   * Requires: STUDENT_EDIT
   */
  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Students"],
        summary: "Deactivate a student",
        description: "Soft deletes a student by setting status to inactive",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", description: "Student ID" },
          },
          required: ["id"],
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_EDIT),
      ],
    },
    controller.deleteStudent
  );
}
