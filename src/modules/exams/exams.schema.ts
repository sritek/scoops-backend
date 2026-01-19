/**
 * Exams Zod Schemas
 */

import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination.js";

/**
 * Create exam schema
 */
export const createExamSchema = z.object({
  batchId: z.string().uuid(),
  subjectId: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  type: z.enum(["unit_test", "mid_term", "final", "practical", "assignment"]),
  totalMarks: z.number().int().min(1).max(1000),
  passingMarks: z.number().int().min(0).max(1000),
  examDate: z.string(),
});

/**
 * Update exam schema
 */
export const updateExamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  totalMarks: z.number().int().min(1).max(1000).optional(),
  passingMarks: z.number().int().min(0).max(1000).optional(),
  examDate: z.string().optional(),
  isPublished: z.boolean().optional(),
});

/**
 * Exam ID param schema
 */
export const examIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * List exams query schema
 */
export const listExamsQuerySchema = paginationQuerySchema.extend({
  batchId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  type: z.enum(["unit_test", "mid_term", "final", "practical", "assignment"]).optional(),
  isPublished: z.string().transform((v) => v === "true").optional(),
});

/**
 * Save scores schema
 */
export const saveScoresSchema = z.object({
  scores: z.array(
    z.object({
      studentId: z.string().uuid(),
      marksObtained: z.number().int().min(0).nullable(),
      remarks: z.string().max(500).optional(),
    })
  ),
});

/**
 * Student ID param schema
 */
export const studentIdParamSchema = z.object({
  studentId: z.string().uuid(),
});

// Types
export type CreateExamInput = z.infer<typeof createExamSchema>;
export type UpdateExamInput = z.infer<typeof updateExamSchema>;
export type ExamIdParam = z.infer<typeof examIdParamSchema>;
export type ListExamsQuery = z.infer<typeof listExamsQuerySchema>;
export type SaveScoresInput = z.infer<typeof saveScoresSchema>;
export type StudentIdParam = z.infer<typeof studentIdParamSchema>;
