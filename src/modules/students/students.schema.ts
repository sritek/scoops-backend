import { z } from "zod";

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
 * Schema for parent input (embedded in student)
 * Phone is mandatory
 */
export const parentInputSchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  phone: z.string().min(10).max(15),
  relation: z.enum(["father", "mother", "guardian", "other"]),
});

/**
 * Schema for creating a student
 */
export const createStudentSchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  gender: z.enum(["male", "female", "other"]).optional(),
  dob: z.string().datetime().optional(),
  category: z.enum(["gen", "sc", "st", "obc", "minority"]).optional(),
  isCwsn: z.boolean().optional().default(false),
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
  dob: z.string().datetime().optional(),
  category: z.enum(["gen", "sc", "st", "obc", "minority"]).optional(),
  isCwsn: z.boolean().optional(),
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
 * Type definitions
 */
export type ParentInput = z.infer<typeof parentInputSchema>;
export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type StudentIdParam = z.infer<typeof studentIdParamSchema>;
