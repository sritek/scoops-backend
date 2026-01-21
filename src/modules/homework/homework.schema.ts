/**
 * Homework Schema Definitions
 *
 * Zod schemas for validating homework data
 */

import { z } from "zod";

/**
 * Homework status enum
 */
export const homeworkStatusSchema = z.enum(["draft", "published", "closed"]);
export type HomeworkStatus = z.infer<typeof homeworkStatusSchema>;

/**
 * Submission status enum
 */
export const submissionStatusSchema = z.enum(["pending", "submitted", "late", "graded"]);
export type SubmissionStatus = z.infer<typeof submissionStatusSchema>;

/**
 * Attachment schema
 */
export const attachmentSchema = z.object({
  name: z.string(),
  url: z.string().url(),
});

/**
 * Create homework schema
 */
export const createHomeworkSchema = z.object({
  batchId: z.string().uuid(),
  subjectId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  attachments: z.array(attachmentSchema).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  totalMarks: z.number().int().positive().nullable().optional(),
});

export type CreateHomeworkInput = z.infer<typeof createHomeworkSchema>;

/**
 * Update homework schema
 */
export const updateHomeworkSchema = z.object({
  batchId: z.string().uuid().optional(),
  subjectId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  attachments: z.array(attachmentSchema).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format").optional(),
  totalMarks: z.number().int().positive().nullable().optional(),
});

export type UpdateHomeworkInput = z.infer<typeof updateHomeworkSchema>;

/**
 * Grade submission schema
 */
export const gradeSubmissionSchema = z.object({
  marks: z.number().int().min(0),
  feedback: z.string().max(1000).optional(),
});

export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;

/**
 * Query parameters for listing homework
 */
export const homeworkQuerySchema = z.object({
  batchId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  status: homeworkStatusSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type HomeworkQueryInput = z.infer<typeof homeworkQuerySchema>;
