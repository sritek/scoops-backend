import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination.js";

/**
 * Student status enum
 */
export const StudentStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

/**
 * Student gender enum (optional)
 */
export const StudentGender = {
  MALE: "male",
  FEMALE: "female",
  OTHER: "other",
} as const;

/**
 * Student category enum (optional)
 */
export const StudentCategory = {
  GEN: "gen",
  SC: "sc",
  ST: "st",
  OBC: "obc",
  MINORITY: "minority",
} as const;

/**
 * Parent relation enum
 */
export const ParentRelation = {
  FATHER: "father",
  MOTHER: "mother",
  GUARDIAN: "guardian",
  OTHER: "other",
} as const;

/**
 * Base64 photo URL validation
 * Accepts data URLs (data:image/...) up to ~500KB
 * Allows null, undefined, or empty string
 */
const photoUrlSchema = z
  .string()
  .refine(
    (val) =>
      val === "" ||
      val.startsWith("data:image/jpeg;base64,") ||
      val.startsWith("data:image/png;base64,") ||
      val.startsWith("data:image/webp;base64,"),
    { message: "Photo must be a valid Base64 data URL (jpeg, png, or webp)" },
  )
  .refine((val) => val === "" || val.length <= 700000, {
    message: "Photo size must be less than 500KB",
  })
  .nullish()
  .or(z.null())
  .transform((val) => val || null);

/**
 * Schema for parent input (embedded in student)
 * Phone is mandatory
 */
export const parentInputSchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  phone: z.string().min(10).max(15),
  relation: z.enum(["father", "mother", "guardian", "other"]),
  photoUrl: photoUrlSchema,
  isPrimaryContact: z.boolean().optional().default(false),
});

// Helper to create a nullable enum that also accepts empty string (converts to null)
const nullableEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(
    (val) => (val === "" || val === null ? null : val),
    z.enum(values).nullable(),
  );

const studentHealthInputSchema = z.object({
  // Basic Vitals
  bloodGroup: nullableEnum([
    "A_positive",
    "A_negative",
    "B_positive",
    "B_negative",
    "AB_positive",
    "AB_negative",
    "O_positive",
    "O_negative",
    "unknown",
  ]).optional(),
  heightCm: z.number().positive().optional().nullable(),
  weightKg: z.number().positive().optional().nullable(),

  // Medical History
  allergies: z.string().max(500).optional().nullable(),
  chronicConditions: z.string().max(500).optional().nullable(),
  currentMedications: z.string().max(500).optional().nullable(),
  pastSurgeries: z.string().max(500).optional().nullable(),

  // Sensory
  visionLeft: nullableEnum([
    "normal",
    "corrected_with_glasses",
    "corrected_with_lenses",
    "impaired",
  ]).optional(),
  visionRight: nullableEnum([
    "normal",
    "corrected_with_glasses",
    "corrected_with_lenses",
    "impaired",
  ]).optional(),
  usesGlasses: z.boolean().optional(),
  hearingStatus: nullableEnum([
    "normal",
    "mild_impairment",
    "moderate_impairment",
    "severe_impairment",
  ]).optional(),
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
  insuranceExpiry: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),

  // Emergency
  emergencyMedicalNotes: z.string().max(1000).optional().nullable(),
  familyDoctorName: z.string().max(200).optional().nullable(),
  familyDoctorPhone: z.string().max(20).optional().nullable(),
  preferredHospital: z.string().max(200).optional().nullable(),

  // Checkup Tracking
  lastCheckupDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  nextCheckupDue: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),

  // Dietary
  dietaryRestrictions: z.string().max(500).optional().nullable(),
});

/**
 * Custom discount type enum
 */
export const CustomDiscountType = {
  PERCENTAGE: "percentage",
  FIXED_AMOUNT: "fixed_amount",
} as const;

/**
 * Schema for custom discount input
 * Validates percentage (0-100) and fixed amount (positive)
 */
export const customDiscountSchema = z
  .object({
    type: z.enum(["percentage", "fixed_amount"]),
    value: z.number().positive("Discount value must be positive"),
    remarks: z.string().max(500).optional(),
  })
  .refine(
    (data) => {
      if (data.type === "percentage") {
        return data.value >= 0 && data.value <= 100;
      }
      return data.value > 0;
    },
    {
      message:
        "Percentage discount must be between 0 and 100, fixed amount must be positive",
    },
  );

/**
 * Schema for creating a student
 */
export const createStudentSchema = z
  .object({
    firstName: z.string().min(1).max(255),
    lastName: z.string().min(1).max(255),
    gender: z.enum(["male", "female", "other"]).optional(),
    // Accept both date (YYYY-MM-DD) and datetime (ISO 8601) formats
    dob: z
      .string()
      .refine((val) => !val || /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(val), {
        message: "Invalid date format",
      })
      .optional(),
    category: z.enum(["gen", "sc", "st", "obc", "minority"]).optional(),
    isCwsn: z.boolean().optional().default(false),
    photoUrl: photoUrlSchema,
    admissionYear: z.number().int().min(2000).max(2100),
    batchId: z.string().uuid().optional(),
    parents: z.array(parentInputSchema).optional(),
    // New optional fields for transactional creation
    health: studentHealthInputSchema.optional(),
    batchFeeStructureId: z.string().uuid().optional(),
    scholarshipIds: z.array(z.string().uuid()).optional(),
    sessionId: z.string().uuid().optional(),
    // Custom discount for student-specific fee adjustments
    customDiscount: customDiscountSchema.optional(),
  })
  .refine(
    (data) => {
      // sessionId is required if batchFeeStructureId or scholarshipIds are provided
      if (
        data.batchFeeStructureId ||
        (data.scholarshipIds && data.scholarshipIds.length > 0)
      ) {
        return !!data.sessionId;
      }
      return true;
    },
    {
      message:
        "sessionId is required when batchFeeStructureId or scholarshipIds are provided",
      path: ["sessionId"],
    },
  );

/**
 * Schema for updating a student
 */
export const updateStudentSchema = z.object({
  firstName: z.string().min(1).max(255).optional(),
  lastName: z.string().min(1).max(255).optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  // Accept both date (YYYY-MM-DD) and datetime (ISO 8601) formats
  dob: z
    .string()
    .refine((val) => !val || /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(val), {
      message: "Invalid date format",
    })
    .optional(),
  category: z.enum(["gen", "sc", "st", "obc", "minority"]).optional(),
  isCwsn: z.boolean().optional(),
  photoUrl: photoUrlSchema,
  admissionYear: z.number().int().min(2000).max(2100).optional(),
  batchId: z.string().uuid().nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  parents: z.array(parentInputSchema).optional(),
  // Health data (optional)
  health: studentHealthInputSchema.optional(),
});

/**
 * Schema for student ID param
 */
export const studentIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Schema for listing students with pagination and filters
 */
export const listStudentsQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  batchId: z.string().uuid().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  category: z.enum(["gen", "sc", "st", "obc", "minority"]).optional(),
});

/**
 * Type definitions
 */
export type ParentInput = z.infer<typeof parentInputSchema>;
export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type StudentIdParam = z.infer<typeof studentIdParamSchema>;
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;
export type CustomDiscountInput = z.infer<typeof customDiscountSchema>;

/**
 * Student filters for service layer
 */
export interface StudentFilters {
  search?: string;
  status?: string;
  batchId?: string;
  gender?: string;
  category?: string;
}
