import { z } from "zod";

/**
 * Blood group enum values
 */
export const BloodGroup = {
  A_POSITIVE: "A_positive",
  A_NEGATIVE: "A_negative",
  B_POSITIVE: "B_positive",
  B_NEGATIVE: "B_negative",
  AB_POSITIVE: "AB_positive",
  AB_NEGATIVE: "AB_negative",
  O_POSITIVE: "O_positive",
  O_NEGATIVE: "O_negative",
  UNKNOWN: "unknown",
} as const;

/**
 * Vision status enum values
 */
export const VisionStatus = {
  NORMAL: "normal",
  CORRECTED_WITH_GLASSES: "corrected_with_glasses",
  CORRECTED_WITH_LENSES: "corrected_with_lenses",
  IMPAIRED: "impaired",
} as const;

/**
 * Hearing status enum values
 */
export const HearingStatus = {
  NORMAL: "normal",
  MILD_IMPAIRMENT: "mild_impairment",
  MODERATE_IMPAIRMENT: "moderate_impairment",
  SEVERE_IMPAIRMENT: "severe_impairment",
} as const;

/**
 * Schema for updating student health data
 */
export const updateStudentHealthSchema = z.object({
  // Basic Vitals
  bloodGroup: z
    .enum([
      "A_positive",
      "A_negative",
      "B_positive",
      "B_negative",
      "AB_positive",
      "AB_negative",
      "O_positive",
      "O_negative",
      "unknown",
    ])
    .optional()
    .nullable(),
  heightCm: z.number().positive().optional().nullable(),
  weightKg: z.number().positive().optional().nullable(),

  // Medical History
  allergies: z.string().max(500).optional().nullable(),
  chronicConditions: z.string().max(500).optional().nullable(),
  currentMedications: z.string().max(500).optional().nullable(),
  pastSurgeries: z.string().max(500).optional().nullable(),

  // Sensory
  visionLeft: z
    .enum(["normal", "corrected_with_glasses", "corrected_with_lenses", "impaired"])
    .optional()
    .nullable(),
  visionRight: z
    .enum(["normal", "corrected_with_glasses", "corrected_with_lenses", "impaired"])
    .optional()
    .nullable(),
  usesGlasses: z.boolean().optional(),
  hearingStatus: z
    .enum(["normal", "mild_impairment", "moderate_impairment", "severe_impairment"])
    .optional()
    .nullable(),
  usesHearingAid: z.boolean().optional(),

  // Physical
  physicalDisability: z.string().max(500).optional().nullable(),
  mobilityAid: z.string().max(100).optional().nullable(),

  // Vaccinations
  vaccinationRecords: z.record(z.string()).optional().nullable(),

  // Insurance
  hasInsurance: z.boolean().optional(),
  insuranceProvider: z.string().max(200).optional().nullable(),
  insurancePolicyNo: z.string().max(100).optional().nullable(),
  insuranceExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),

  // Emergency
  emergencyMedicalNotes: z.string().max(1000).optional().nullable(),
  familyDoctorName: z.string().max(200).optional().nullable(),
  familyDoctorPhone: z.string().max(20).optional().nullable(),
  preferredHospital: z.string().max(200).optional().nullable(),

  // Checkup Tracking
  lastCheckupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  nextCheckupDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),

  // Dietary
  dietaryRestrictions: z.string().max(500).optional().nullable(),
});

/**
 * Schema for creating a health checkup
 */
export const createHealthCheckupSchema = z.object({
  checkupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  heightCm: z.number().positive().optional(),
  weightKg: z.number().positive().optional(),
  visionLeft: z.string().max(20).optional(),
  visionRight: z.string().max(20).optional(),
  bloodPressure: z.string().max(20).optional(),
  pulse: z.number().positive().optional(),
  dentalStatus: z.string().max(100).optional(),
  findings: z.string().max(2000).optional(),
  recommendations: z.string().max(2000).optional(),
  conductedBy: z.string().max(200).optional(),
});

/**
 * Schema for student ID param
 */
export const studentIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Schema for checkup ID param
 */
export const checkupIdParamSchema = z.object({
  checkupId: z.string().uuid(),
});

/**
 * Type definitions
 */
export type UpdateStudentHealthInput = z.infer<typeof updateStudentHealthSchema>;
export type CreateHealthCheckupInput = z.infer<typeof createHealthCheckupSchema>;
export type StudentIdParam = z.infer<typeof studentIdParamSchema>;
export type CheckupIdParam = z.infer<typeof checkupIdParamSchema>;
