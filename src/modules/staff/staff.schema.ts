import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination.js";

/**
 * Employment types (must match Prisma EmploymentType enum)
 */
export const EmploymentTypes = {
  FULL_TIME: "full_time",
  PART_TIME: "part_time",
  CONTRACT: "contract",
} as const;

/**
 * Staff attendance status (must match Prisma StaffAttendanceStatus enum)
 */
export const StaffAttendanceStatuses = {
  PRESENT: "present",
  ABSENT: "absent",
  HALF_DAY: "half_day",
  LEAVE: "leave",
} as const;

/**
 * Leave types (must match Prisma LeaveType enum)
 */
export const LeaveTypes = {
  CASUAL: "casual",
  SICK: "sick",
  EARNED: "earned",
  UNPAID: "unpaid",
} as const;

/**
 * Schema for updating staff profile
 */
export const updateStaffProfileSchema = z.object({
  employmentType: z.enum(["full_time", "part_time", "contract"]).optional(),
  joiningDate: z.string().datetime().optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  designation: z.string().max(100).optional().nullable(),
  salary: z.number().int().min(0).optional().nullable(),
  emergencyContact: z.string().min(10).max(15).optional().nullable(),
});

export type UpdateStaffProfileInput = z.infer<typeof updateStaffProfileSchema>;

/**
 * Schema for staff ID param
 */
export const staffIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type StaffIdParam = z.infer<typeof staffIdParamSchema>;

/**
 * Schema for listing staff with pagination and filters
 */
export const listStaffQuerySchema = paginationQuerySchema.extend({
  role: z.enum(["admin", "teacher", "accounts", "staff"]).optional(),
  department: z.string().optional(),
  employmentType: z.enum(["full_time", "part_time", "contract"]).optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined;
    }),
  search: z.string().optional(),
});

export type ListStaffQuery = z.infer<typeof listStaffQuerySchema>;

/**
 * Staff filters for service layer
 */
export interface StaffFilters {
  role?: string;
  department?: string;
  employmentType?: string;
  isActive?: boolean;
  search?: string;
}

/**
 * Schema for self check-in
 */
export const checkInSchema = z.object({
  notes: z.string().max(500).optional(),
});

export type CheckInInput = z.infer<typeof checkInSchema>;

/**
 * Schema for self check-out
 */
export const checkOutSchema = z.object({
  notes: z.string().max(500).optional(),
});

export type CheckOutInput = z.infer<typeof checkOutSchema>;

/**
 * Schema for admin marking attendance
 */
export const markStaffAttendanceSchema = z.object({
  userId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  status: z.enum(["present", "absent", "half_day", "leave"]),
  leaveType: z.enum(["casual", "sick", "earned", "unpaid"]).optional(),
  checkIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

export type MarkStaffAttendanceInput = z.infer<typeof markStaffAttendanceSchema>;

/**
 * Schema for listing staff attendance with pagination and filters
 */
export const listStaffAttendanceQuerySchema = paginationQuerySchema.extend({
  userId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["present", "absent", "half_day", "leave"]).optional(),
});

export type ListStaffAttendanceQuery = z.infer<typeof listStaffAttendanceQuerySchema>;

/**
 * Staff attendance filters for service layer
 */
export interface StaffAttendanceFilters {
  userId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

/**
 * Schema for attendance date param
 */
export const attendanceDateParamSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
});

export type AttendanceDateParam = z.infer<typeof attendanceDateParamSchema>;
