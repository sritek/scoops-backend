import type { Prisma, Role, EmploymentType, StaffAttendanceStatus, LeaveType } from "@prisma/client";
import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import { BadRequestError } from "../../utils/error-handler.js";
import {
  type PaginationParams,
  createPaginatedResponse,
  calculateSkip,
} from "../../utils/pagination.js";
import type {
  UpdateStaffProfileInput,
  StaffFilters,
  CheckInInput,
  CheckOutInput,
  MarkStaffAttendanceInput,
  StaffAttendanceFilters,
} from "./staff.schema.js";

/**
 * Helper to format full name
 */
function formatFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/**
 * Format staff member for response
 */
function formatStaffResponse(user: {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  photoUrl: string | null;
  role: Role;
  isActive: boolean;
  orgId: string;
  branchId: string;
  employmentType: EmploymentType | null;
  joiningDate: Date | null;
  department: string | null;
  designation: string | null;
  salary: number | null;
  emergencyContact: string | null;
  createdAt: Date;
  updatedAt: Date;
  branch?: { id: string; name: string } | null;
}) {
  return {
    id: user.id,
    employeeId: user.employeeId,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: formatFullName(user.firstName, user.lastName),
    phone: user.phone,
    email: user.email,
    photoUrl: user.photoUrl,
    role: user.role,
    isActive: user.isActive,
    orgId: user.orgId,
    branchId: user.branchId,
    branchName: user.branch?.name ?? null,
    // Staff-specific fields
    employmentType: user.employmentType,
    joiningDate: user.joiningDate,
    department: user.department,
    designation: user.designation,
    salary: user.salary,
    emergencyContact: user.emergencyContact,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Get staff members with pagination and filters
 */
export async function getStaffList(
  scope: TenantScope,
  pagination: PaginationParams,
  filters?: StaffFilters
) {
  const where: Prisma.UserWhereInput = {
    orgId: scope.orgId,
    branchId: scope.branchId,
  };

  // Add role filter
  if (filters?.role) {
    where.role = filters.role as Role;
  }

  // Add department filter
  if (filters?.department) {
    where.department = filters.department;
  }

  // Add employment type filter
  if (filters?.employmentType) {
    where.employmentType = filters.employmentType as EmploymentType;
  }

  // Add isActive filter
  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  // Add search filter
  if (filters?.search) {
    where.OR = [
      { firstName: { contains: filters.search, mode: "insensitive" } },
      { lastName: { contains: filters.search, mode: "insensitive" } },
      { employeeId: { contains: filters.search, mode: "insensitive" } },
      { department: { contains: filters.search, mode: "insensitive" } },
      { designation: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ department: "asc" }, { firstName: "asc" }],
      skip: calculateSkip(pagination),
      take: pagination.limit,
    }),
    prisma.user.count({ where }),
  ]);

  return createPaginatedResponse(
    users.map(formatStaffResponse),
    total,
    pagination
  );
}

/**
 * Get a single staff member by ID
 */
export async function getStaffById(id: string, scope: TenantScope) {
  const user = await prisma.user.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
    include: {
      branch: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!user) return null;

  return formatStaffResponse(user);
}

/**
 * Update staff profile (staff-specific fields)
 */
export async function updateStaffProfile(
  id: string,
  input: UpdateStaffProfileInput,
  scope: TenantScope
) {
  // First verify user belongs to tenant
  const existing = await prisma.user.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!existing) {
    return null;
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      employmentType: input.employmentType as EmploymentType | undefined,
      joiningDate: input.joiningDate ? new Date(input.joiningDate) : input.joiningDate,
      department: input.department,
      designation: input.designation,
      salary: input.salary,
      emergencyContact: input.emergencyContact,
    },
    include: {
      branch: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return formatStaffResponse(user);
}

/**
 * Get unique departments in the organization
 */
export async function getDepartments(scope: TenantScope) {
  const departments = await prisma.user.findMany({
    where: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      department: { not: null },
    },
    select: {
      department: true,
    },
    distinct: ["department"],
    orderBy: { department: "asc" },
  });

  return departments.map((d) => d.department).filter(Boolean) as string[];
}

// =====================
// Staff Attendance
// =====================

/**
 * Format staff attendance for response
 */
function formatStaffAttendanceResponse(attendance: {
  id: string;
  userId: string;
  date: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  status: StaffAttendanceStatus;
  leaveType: LeaveType | null;
  notes: string | null;
  createdAt: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
    role: Role;
    department: string | null;
  };
}) {
  const checkIn = attendance.checkIn;
  const checkOut = attendance.checkOut;
  
  // Calculate hours worked
  let hoursWorked: number | null = null;
  if (checkIn && checkOut) {
    const diffMs = checkOut.getTime() - checkIn.getTime();
    hoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
  }

  return {
    id: attendance.id,
    userId: attendance.userId,
    date: attendance.date.toISOString().split("T")[0],
    checkIn: checkIn?.toISOString() ?? null,
    checkOut: checkOut?.toISOString() ?? null,
    status: attendance.status,
    leaveType: attendance.leaveType,
    notes: attendance.notes,
    hoursWorked,
    createdAt: attendance.createdAt,
    user: {
      id: attendance.user.id,
      firstName: attendance.user.firstName,
      lastName: attendance.user.lastName,
      fullName: formatFullName(attendance.user.firstName, attendance.user.lastName),
      employeeId: attendance.user.employeeId,
      role: attendance.user.role,
      department: attendance.user.department,
    },
  };
}

/**
 * Self check-in for current user
 */
export async function checkIn(
  userId: string,
  input: CheckInInput,
  scope: TenantScope
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if already checked in today
  const existing = await prisma.staffAttendance.findUnique({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
  });

  if (existing) {
    if (existing.checkIn) {
      throw new BadRequestError("Already checked in today");
    }
    // Update existing record with check-in time
    const updated = await prisma.staffAttendance.update({
      where: { id: existing.id },
      data: {
        checkIn: new Date(),
        status: "present",
        notes: input.notes || existing.notes,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            role: true,
            department: true,
          },
        },
      },
    });
    return formatStaffAttendanceResponse(updated);
  }

  // Create new attendance record
  const attendance = await prisma.staffAttendance.create({
    data: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      userId,
      date: today,
      checkIn: new Date(),
      status: "present",
      notes: input.notes,
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeId: true,
          role: true,
          department: true,
        },
      },
    },
  });

  return formatStaffAttendanceResponse(attendance);
}

/**
 * Self check-out for current user
 */
export async function checkOut(
  userId: string,
  input: CheckOutInput,
  scope: TenantScope
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find today's attendance record
  const existing = await prisma.staffAttendance.findUnique({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
  });

  if (!existing) {
    throw new BadRequestError("No check-in found for today. Please check in first.");
  }

  if (!existing.checkIn) {
    throw new BadRequestError("No check-in found for today. Please check in first.");
  }

  if (existing.checkOut) {
    throw new BadRequestError("Already checked out today");
  }

  const updated = await prisma.staffAttendance.update({
    where: { id: existing.id },
    data: {
      checkOut: new Date(),
      notes: input.notes ? `${existing.notes || ""}\n${input.notes}`.trim() : existing.notes,
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeId: true,
          role: true,
          department: true,
        },
      },
    },
  });

  return formatStaffAttendanceResponse(updated);
}

/**
 * Get current user's attendance status for today
 */
export async function getMyTodayAttendance(userId: string, scope: TenantScope) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const attendance = await prisma.staffAttendance.findUnique({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeId: true,
          role: true,
          department: true,
        },
      },
    },
  });

  if (!attendance) {
    return {
      hasCheckedIn: false,
      hasCheckedOut: false,
      attendance: null,
    };
  }

  return {
    hasCheckedIn: !!attendance.checkIn,
    hasCheckedOut: !!attendance.checkOut,
    attendance: formatStaffAttendanceResponse(attendance),
  };
}

/**
 * Admin: Mark staff attendance
 */
export async function markStaffAttendance(
  input: MarkStaffAttendanceInput,
  scope: TenantScope
) {
  // Verify user belongs to tenant
  const user = await prisma.user.findFirst({
    where: {
      id: input.userId,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!user) {
    throw new BadRequestError("Staff member not found");
  }

  const date = new Date(input.date);
  date.setHours(0, 0, 0, 0);

  // Validate leave type is provided for leave status
  if (input.status === "leave" && !input.leaveType) {
    throw new BadRequestError("Leave type is required when marking as leave");
  }

  // Upsert attendance record
  const attendance = await prisma.staffAttendance.upsert({
    where: {
      userId_date: {
        userId: input.userId,
        date,
      },
    },
    update: {
      status: input.status as StaffAttendanceStatus,
      leaveType: input.leaveType as LeaveType | undefined,
      checkIn: input.checkIn ? new Date(input.checkIn) : undefined,
      checkOut: input.checkOut ? new Date(input.checkOut) : undefined,
      notes: input.notes,
    },
    create: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      userId: input.userId,
      date,
      status: input.status as StaffAttendanceStatus,
      leaveType: input.leaveType as LeaveType | undefined,
      checkIn: input.checkIn ? new Date(input.checkIn) : null,
      checkOut: input.checkOut ? new Date(input.checkOut) : null,
      notes: input.notes,
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeId: true,
          role: true,
          department: true,
        },
      },
    },
  });

  return formatStaffAttendanceResponse(attendance);
}

/**
 * Get staff attendance history with filters
 */
export async function getStaffAttendanceHistory(
  scope: TenantScope,
  pagination: PaginationParams,
  filters?: StaffAttendanceFilters
) {
  const where: Prisma.StaffAttendanceWhereInput = {
    orgId: scope.orgId,
    branchId: scope.branchId,
  };

  // Filter by user
  if (filters?.userId) {
    where.userId = filters.userId;
  }

  // Filter by status
  if (filters?.status) {
    where.status = filters.status as StaffAttendanceStatus;
  }

  // Filter by date range
  if (filters?.startDate || filters?.endDate) {
    where.date = {};
    if (filters.startDate) {
      where.date.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setDate(endDate.getDate() + 1);
      where.date.lt = endDate;
    }
  }

  const [records, total] = await Promise.all([
    prisma.staffAttendance.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            role: true,
            department: true,
          },
        },
      },
      orderBy: { date: "desc" },
      skip: calculateSkip(pagination),
      take: pagination.limit,
    }),
    prisma.staffAttendance.count({ where }),
  ]);

  return createPaginatedResponse(
    records.map(formatStaffAttendanceResponse),
    total,
    pagination
  );
}

/**
 * Get today's attendance summary
 */
export async function getTodayAttendanceSummary(scope: TenantScope) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get total active staff count
  const totalStaff = await prisma.user.count({
    where: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      isActive: true,
    },
  });

  // Get today's attendance records
  const todayRecords = await prisma.staffAttendance.groupBy({
    by: ["status"],
    where: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      date: today,
    },
    _count: true,
  });

  // Calculate stats
  const stats = {
    present: 0,
    absent: 0,
    halfDay: 0,
    leave: 0,
    notMarked: 0,
  };

  let markedCount = 0;
  for (const record of todayRecords) {
    markedCount += record._count;
    switch (record.status) {
      case "present":
        stats.present = record._count;
        break;
      case "absent":
        stats.absent = record._count;
        break;
      case "half_day":
        stats.halfDay = record._count;
        break;
      case "leave":
        stats.leave = record._count;
        break;
    }
  }

  stats.notMarked = totalStaff - markedCount;

  // Get detailed attendance with user info
  const detailedAttendance = await prisma.staffAttendance.findMany({
    where: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      date: today,
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeId: true,
          role: true,
          department: true,
        },
      },
    },
    orderBy: [{ user: { department: "asc" } }, { user: { firstName: "asc" } }],
  });

  return {
    date: today.toISOString().split("T")[0],
    totalStaff,
    stats,
    attendance: detailedAttendance.map(formatStaffAttendanceResponse),
  };
}

/**
 * Get staff who haven't marked attendance today
 */
export async function getUnmarkedStaff(scope: TenantScope) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get all active staff IDs
  const activeStaff = await prisma.user.findMany({
    where: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      isActive: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeId: true,
      role: true,
      department: true,
    },
  });

  // Get IDs of staff who have marked attendance today
  const markedAttendance = await prisma.staffAttendance.findMany({
    where: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      date: today,
    },
    select: {
      userId: true,
    },
  });

  const markedIds = new Set(markedAttendance.map((a) => a.userId));

  // Filter out staff who have marked attendance
  const unmarkedStaff = activeStaff.filter((s) => !markedIds.has(s.id));

  return unmarkedStaff.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    fullName: formatFullName(s.firstName, s.lastName),
    employeeId: s.employeeId,
    role: s.role,
    department: s.department,
  }));
}
