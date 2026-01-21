import type { FastifyInstance } from "fastify";
import { branchContextMiddleware } from "../../middleware/branch.middleware.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions";
import * as controller from "./health.controller.js";

/**
 * Health module routes (mounted under /students/:id)
 */
export async function healthRoutes(app: FastifyInstance) {
  /**
   * GET /students/:id/health
   * Get student health data
   * Requires: STUDENT_VIEW
   */
  app.get(
    "/:id/health",
    {
      schema: {
        tags: ["Student Health"],
        summary: "Get student health data",
        description: "Returns health information for a student",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_VIEW),
      ],
    },
    controller.getStudentHealth
  );

  /**
   * PUT /students/:id/health
   * Update student health data
   * Requires: STUDENT_EDIT
   */
  app.put(
    "/:id/health",
    {
      schema: {
        tags: ["Student Health"],
        summary: "Update student health data",
        description: "Creates or updates health information for a student",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            bloodGroup: {
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
              nullable: true,
            },
            heightCm: { type: "number", minimum: 0, nullable: true },
            weightKg: { type: "number", minimum: 0, nullable: true },
            allergies: { type: "string", maxLength: 500, nullable: true },
            chronicConditions: { type: "string", maxLength: 500, nullable: true },
            currentMedications: { type: "string", maxLength: 500, nullable: true },
            pastSurgeries: { type: "string", maxLength: 500, nullable: true },
            visionLeft: {
              type: "string",
              enum: ["normal", "corrected_with_glasses", "corrected_with_lenses", "impaired"],
              nullable: true,
            },
            visionRight: {
              type: "string",
              enum: ["normal", "corrected_with_glasses", "corrected_with_lenses", "impaired"],
              nullable: true,
            },
            usesGlasses: { type: "boolean" },
            hearingStatus: {
              type: "string",
              enum: ["normal", "mild_impairment", "moderate_impairment", "severe_impairment"],
              nullable: true,
            },
            usesHearingAid: { type: "boolean" },
            physicalDisability: { type: "string", maxLength: 500, nullable: true },
            mobilityAid: { type: "string", maxLength: 100, nullable: true },
            vaccinationRecords: { type: "object", nullable: true },
            hasInsurance: { type: "boolean" },
            insuranceProvider: { type: "string", maxLength: 200, nullable: true },
            insurancePolicyNo: { type: "string", maxLength: 100, nullable: true },
            insuranceExpiry: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}$",
              nullable: true,
            },
            emergencyMedicalNotes: { type: "string", maxLength: 1000, nullable: true },
            familyDoctorName: { type: "string", maxLength: 200, nullable: true },
            familyDoctorPhone: { type: "string", maxLength: 20, nullable: true },
            preferredHospital: { type: "string", maxLength: 200, nullable: true },
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
            dietaryRestrictions: { type: "string", maxLength: 500, nullable: true },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_EDIT),
      ],
    },
    controller.updateStudentHealth
  );

  /**
   * GET /students/:id/checkups
   * Get health checkup history
   * Requires: STUDENT_VIEW
   */
  app.get(
    "/:id/checkups",
    {
      schema: {
        tags: ["Student Health"],
        summary: "Get health checkup history",
        description: "Returns all health checkup records for a student",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_VIEW),
      ],
    },
    controller.getHealthCheckups
  );

  /**
   * POST /students/:id/checkups
   * Create health checkup
   * Requires: STUDENT_EDIT
   */
  app.post(
    "/:id/checkups",
    {
      schema: {
        tags: ["Student Health"],
        summary: "Record health checkup",
        description: "Creates a new health checkup record",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          required: ["checkupDate"],
          properties: {
            checkupDate: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}$",
              description: "Date of checkup (YYYY-MM-DD)",
            },
            heightCm: { type: "number", minimum: 0 },
            weightKg: { type: "number", minimum: 0 },
            visionLeft: { type: "string", maxLength: 20 },
            visionRight: { type: "string", maxLength: 20 },
            bloodPressure: { type: "string", maxLength: 20 },
            pulse: { type: "integer", minimum: 0 },
            dentalStatus: { type: "string", maxLength: 100 },
            findings: { type: "string", maxLength: 2000 },
            recommendations: { type: "string", maxLength: 2000 },
            conductedBy: { type: "string", maxLength: 200 },
          },
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_EDIT),
      ],
    },
    controller.createHealthCheckup
  );

  /**
   * GET /students/:id/checkups/:checkupId
   * Get specific health checkup
   * Requires: STUDENT_VIEW
   */
  app.get(
    "/:id/checkups/:checkupId",
    {
      schema: {
        tags: ["Student Health"],
        summary: "Get health checkup",
        description: "Returns details of a specific health checkup",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            checkupId: { type: "string", format: "uuid" },
          },
          required: ["id", "checkupId"],
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_VIEW),
      ],
    },
    controller.getHealthCheckup
  );

  /**
   * DELETE /students/:id/checkups/:checkupId
   * Delete health checkup
   * Requires: STUDENT_EDIT
   */
  app.delete(
    "/:id/checkups/:checkupId",
    {
      schema: {
        tags: ["Student Health"],
        summary: "Delete health checkup",
        description: "Deletes a health checkup record",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            checkupId: { type: "string", format: "uuid" },
          },
          required: ["id", "checkupId"],
        },
      },
      preHandler: [
        branchContextMiddleware,
        requirePermission(PERMISSIONS.STUDENT_EDIT),
      ],
    },
    controller.deleteHealthCheckup
  );
}
