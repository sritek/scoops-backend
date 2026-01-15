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
    { message: "Photo must be a valid Base64 data URL (jpeg, png, or webp)" }
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
});

/**
 * Schema for creating a student
 */
export const createStudentSchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  gender: z.enum(["male", "female", "other"]).optional(),
  // Accept both date (YYYY-MM-DD) and datetime (ISO 8601) formats
  dob: z.string().refine(
    (val) => !val || /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(val),
    { message: "Invalid date format" }
  ).optional(),
  category: z.enum(["gen", "sc", "st", "obc", "minority"]).optional(),
  isCwsn: z.boolean().optional().default(false),
  photoUrl: photoUrlSchema,
  admissionYear: z.number().int().min(2000).max(2100),
  batchId: z.string().uuid().optional(),
  parents: z.array(parentInputSchema).optional(),
});

/**
 * Schema for updating a student
 */
export const updateStudentSchema = z.object({
  firstName: z.string().min(1).max(255).optional(),
  lastName: z.string().min(1).max(255).optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  // Accept both date (YYYY-MM-DD) and datetime (ISO 8601) formats
  dob: z.string().refine(
    (val) => !val || /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(val),
    { message: "Invalid date format" }
  ).optional(),
  category: z.enum(["gen", "sc", "st", "obc", "minority"]).optional(),
  isCwsn: z.boolean().optional(),
  photoUrl: photoUrlSchema,
  admissionYear: z.number().int().min(2000).max(2100).optional(),
  batchId: z.string().uuid().nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  parents: z.array(parentInputSchema).optional(),
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