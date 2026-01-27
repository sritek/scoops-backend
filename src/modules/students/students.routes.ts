import type { FastifyInstance } from "fastify";
import { branchContextMiddleware } from "../../middleware/branch.middleware.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions";
import {
  paginationQueryOpenApi,
  paginationResponseOpenApi,
} from "../../utils/pagination.js";
import * as controller from "./students.controller.js";

/**
 * Students module routes
 * All routes require authentication (applied globally) and branch context
 */
export async function studentsRoutes(app: FastifyInstance) {
  /**
   * GET /students
   * List students with pagination and filters
   * Requires: STUDENT_VIEW
   */
  app.get(
    "/",
    {
      schema: {
        tags: ["Students"],
        summary: "List students",
        description:
          "Returns paginated students in the current branch with their parents. Supports search and filtering.",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            ...paginationQueryOpenApi.properties,
            search: {
              type: "string",
              description: "Search by first name or last name",
            },
            status: {
              type: "string",
              enum: ["active", "inactive"],
              description: "Filter by status",
            },
            batchId: {
              type: "string",
              format: "uuid",
              description: "Filter by batch ID",
            },
            gender: {
              type: "string",
              enum: ["male", "female", "other"],
              description: "Filter by gender",
            },
            category: {
              type: "string",
              enum: ["gen", "sc", "st", "obc", "minority"],
              description: "Filter by category",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "array",
                items: { type: "object", additionalProperties: true },
                description: "Array of students",
              },
              pagination: paginationResponseOpenApi,
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_VIEW),
      ],
    },
    controller.listStudents,
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
    controller.getStudent,
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
        description:
          "Creates a new student atomically with optional parent information, health data, fee structure, and scholarships. All operations happen in a single transaction.",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["firstName", "lastName", "admissionYear"],
          properties: {
            firstName: { type: "string", minLength: 1, maxLength: 255 },
            lastName: { type: "string", minLength: 1, maxLength: 255 },
            gender: { type: "string", enum: ["male", "female", "other"] },
            dob: { type: "string", format: "date" },
            category: {
              type: "string",
              enum: ["gen", "sc", "st", "obc", "minority"],
            },
            isCwsn: { type: "boolean", default: false },
            photoUrl: {
              type: "string",
              description: "Base64 encoded photo (jpeg, png, or webp)",
              nullable: true,
            },
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
                  relation: {
                    type: "string",
                    enum: ["father", "mother", "guardian", "other"],
                  },
                  photoUrl: {
                    type: "string",
                    description: "Base64 encoded photo for parent",
                    nullable: true,
                  },
                  isPrimaryContact: { type: "boolean", default: false },
                },
              },
            },
            health: {
              type: "object",
              description: "Student health data",
              properties: {
                bloodGroup: {
                  oneOf: [
                    { type: "null" },
                    {
                      type: "string",
                      enum: [
                        "A_positive",
                        "A_negative",
                        "B_positive",
                        "B_negative",
                        "AB_positive",
                        "AB_negative",
                        "O_positive",
                        "O_negative",
                        "unknown",
                      ],
                    },
                  ],
                },
                heightCm: { type: "number", minimum: 0, nullable: true },
                weightKg: { type: "number", minimum: 0, nullable: true },
                allergies: { type: "string", maxLength: 500, nullable: true },
                chronicConditions: {
                  type: "string",
                  maxLength: 500,
                  nullable: true,
                },
                currentMedications: {
                  type: "string",
                  maxLength: 500,
                  nullable: true,
                },
                pastSurgeries: {
                  type: "string",
                  maxLength: 500,
                  nullable: true,
                },
                visionLeft: {
                  oneOf: [
                    { type: "null" },
                    {
                      type: "string",
                      enum: [
                        "normal",
                        "corrected_with_glasses",
                        "corrected_with_lenses",
                        "impaired",
                      ],
                    },
                  ],
                },
                visionRight: {
                  oneOf: [
                    { type: "null" },
                    {
                      type: "string",
                      enum: [
                        "normal",
                        "corrected_with_glasses",
                        "corrected_with_lenses",
                        "impaired",
                      ],
                    },
                  ],
                },
                usesGlasses: { type: "boolean" },
                hearingStatus: {
                  oneOf: [
                    { type: "null" },
                    {
                      type: "string",
                      enum: [
                        "normal",
                        "mild_impairment",
                        "moderate_impairment",
                        "severe_impairment",
                      ],
                    },
                  ],
                },
                usesHearingAid: { type: "boolean" },
                physicalDisability: {
                  type: "string",
                  maxLength: 500,
                  nullable: true,
                },
                mobilityAid: { type: "string", maxLength: 100, nullable: true },
                vaccinationRecords: {
                  type: "object",
                  additionalProperties: { type: "string" },
                  nullable: true,
                },
                hasInsurance: { type: "boolean" },
                insuranceProvider: {
                  type: "string",
                  maxLength: 200,
                  nullable: true,
                },
                insurancePolicyNo: {
                  type: "string",
                  maxLength: 100,
                  nullable: true,
                },
                insuranceExpiry: {
                  type: "string",
                  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                  nullable: true,
                },
                emergencyMedicalNotes: {
                  type: "string",
                  maxLength: 1000,
                  nullable: true,
                },
                familyDoctorName: {
                  type: "string",
                  maxLength: 200,
                  nullable: true,
                },
                familyDoctorPhone: {
                  type: "string",
                  maxLength: 20,
                  nullable: true,
                },
                preferredHospital: {
                  type: "string",
                  maxLength: 200,
                  nullable: true,
                },
                lastCheckupDate: {
                  type: "string",
                  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                  nullable: true,
                },
                nextCheckupDue: {
                  type: "string",
                  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                  nullable: true,
                },
                dietaryRestrictions: {
                  type: "string",
                  maxLength: 500,
                  nullable: true,
                },
              },
            },
            batchFeeStructureId: {
              type: "string",
              format: "uuid",
              description:
                "Batch fee structure ID to apply. Requires sessionId.",
            },
            scholarshipIds: {
              type: "array",
              items: { type: "string", format: "uuid" },
              description: "Scholarship IDs to assign. Requires sessionId.",
            },
            sessionId: {
              type: "string",
              format: "uuid",
              description:
                "Academic session ID. Required if batchFeeStructureId or scholarshipIds are provided.",
            },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_EDIT),
      ],
    },
    controller.createStudent,
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
            dob: { type: "string", format: "date" },
            category: {
              type: "string",
              enum: ["gen", "sc", "st", "obc", "minority"],
            },
            isCwsn: { type: "boolean" },
            photoUrl: {
              type: "string",
              description: "Base64 encoded photo (jpeg, png, or webp)",
              nullable: true,
            },
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
                  relation: {
                    type: "string",
                    enum: ["father", "mother", "guardian", "other"],
                  },
                  photoUrl: {
                    type: "string",
                    description: "Base64 encoded photo for parent",
                    nullable: true,
                  },
                  isPrimaryContact: { type: "boolean", default: false },
                },
              },
            },
            health: {
              type: "object",
              description: "Student health data",
              properties: {
                bloodGroup: {
                  oneOf: [
                    { type: "null" },
                    {
                      type: "string",
                      enum: [
                        "A_positive",
                        "A_negative",
                        "B_positive",
                        "B_negative",
                        "AB_positive",
                        "AB_negative",
                        "O_positive",
                        "O_negative",
                        "unknown",
                      ],
                    },
                  ],
                },
                heightCm: { type: "number", minimum: 0, nullable: true },
                weightKg: { type: "number", minimum: 0, nullable: true },
                allergies: { type: "string", maxLength: 500, nullable: true },
                chronicConditions: {
                  type: "string",
                  maxLength: 500,
                  nullable: true,
                },
                currentMedications: {
                  type: "string",
                  maxLength: 500,
                  nullable: true,
                },
                pastSurgeries: {
                  type: "string",
                  maxLength: 500,
                  nullable: true,
                },
                visionLeft: {
                  oneOf: [
                    { type: "null" },
                    {
                      type: "string",
                      enum: [
                        "normal",
                        "corrected_with_glasses",
                        "corrected_with_lenses",
                        "impaired",
                      ],
                    },
                  ],
                },
                visionRight: {
                  oneOf: [
                    { type: "null" },
                    {
                      type: "string",
                      enum: [
                        "normal",
                        "corrected_with_glasses",
                        "corrected_with_lenses",
                        "impaired",
                      ],
                    },
                  ],
                },
                usesGlasses: { type: "boolean" },
                hearingStatus: {
                  oneOf: [
                    { type: "null" },
                    {
                      type: "string",
                      enum: [
                        "normal",
                        "mild_impairment",
                        "moderate_impairment",
                        "severe_impairment",
                      ],
                    },
                  ],
                },
                usesHearingAid: { type: "boolean" },
                physicalDisability: {
                  type: "string",
                  maxLength: 500,
                  nullable: true,
                },
                mobilityAid: { type: "string", maxLength: 100, nullable: true },
                vaccinationRecords: {
                  type: "object",
                  additionalProperties: { type: "string" },
                  nullable: true,
                },
                hasInsurance: { type: "boolean" },
                insuranceProvider: {
                  type: "string",
                  maxLength: 200,
                  nullable: true,
                },
                insurancePolicyNo: {
                  type: "string",
                  maxLength: 100,
                  nullable: true,
                },
                insuranceExpiry: {
                  type: "string",
                  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                  nullable: true,
                },
                emergencyMedicalNotes: {
                  type: "string",
                  maxLength: 1000,
                  nullable: true,
                },
                familyDoctorName: {
                  type: "string",
                  maxLength: 200,
                  nullable: true,
                },
                familyDoctorPhone: {
                  type: "string",
                  maxLength: 20,
                  nullable: true,
                },
                preferredHospital: {
                  type: "string",
                  maxLength: 200,
                  nullable: true,
                },
                lastCheckupDate: {
                  type: "string",
                  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                  nullable: true,
                },
                nextCheckupDue: {
                  type: "string",
                  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                  nullable: true,
                },
                dietaryRestrictions: {
                  type: "string",
                  maxLength: 500,
                  nullable: true,
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
    controller.updateStudent,
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
    controller.deleteStudent,
  );
}
