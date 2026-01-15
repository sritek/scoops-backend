import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination.js";

/**
 * Attendance status enum
 */
export const AttendanceStatus = {
  PRESENT: "present",
  ABSENT: "absent",
} as const;

/**
 * Schema for getting attendance (query params)
 */
export const getAttendanceQuerySchema = z.object({
  batchId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
});

/**
 * Schema for getting attendance history (query params)
 */
export const getAttendanceHistoryQuerySchema = paginationQuerySchema.extend({
  batchId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format").optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format").optional(),
});

/**
 * Schema for individual student attendance record
 */
export const attendanceRecordSchema = z.object({
  studentId: z.string().uuid(),
  status: z.enum(["present", "absent"]),
});

/**
 * Schema for marking attendance
 */
export const markAttendanceSchema = z.object({
  batchId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  records: z.array(attendanceRecordSchema).min(1),
});

/**
 * Type definitions
 */
export type GetAttendanceQuery = z.infer<typeof getAttendanceQuerySchema>;
export type GetAttendanceHistoryQuery = z.infer<typeof getAttendanceHistoryQuerySchema>;
export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>;
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
