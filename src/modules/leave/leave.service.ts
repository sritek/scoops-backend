/**
 * Leave Application Service
 *
 * Handles student leave application submission, review, and tracking
 */

import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import { NotFoundError, BadRequestError, ForbiddenError } from "../../utils/error-handler.js";
import {
  type PaginationParams,
  createPaginatedResponse,
  calculateSkip,
} from "../../utils/pagination.js";
import type { StudentLeaveStatus, StudentLeaveType, Prisma } from "@prisma/client";
import type { ParentContext } from "../../middleware/parent-auth.middleware.js";

/**
 * Helper to format full name
 */
function formatFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/**
 * Calculate total days between two dates (inclusive)
 */
function calculateTotalDays(startDate: Date, endDate: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((endDate.getTime() - startDate.getTime()) / oneDay)) + 1;
}

// ============================================================================
// Types
// ============================================================================

export interface SubmitLeaveInput {
  type: StudentLeaveType;
  reason: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface ReviewLeaveInput {
  status: "approved" | "rejected";
  reviewNote?: string;
}

export interface LeaveFilters {
  status?: StudentLeaveStatus;
  batchId?: string;
  studentId?: string;
  startDate?: string;
  endDate?: string;
}

// ============================================================================
// Parent Functions
// ============================================================================

/**
 * Submit a leave application for a child
 */
export async function submitLeaveApplication(
  parentContext: ParentContext,
  studentId: string,
  input: SubmitLeaveInput
) {
  const { parentId, orgId, branchId } = parentContext;

  // Verify parent is linked to this student
  const link = await prisma.studentParent.findUnique({
    where: {
      studentId_parentId: { studentId, parentId },
    },
  });

  if (!link) {
    throw new ForbiddenError("You do not have access to this student");
  }

  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Validate dates
  if (startDate > endDate) {
    throw new BadRequestError("Start date must be before or equal to end date");
  }

  if (startDate < today) {
    throw new BadRequestError("Cannot apply for leave in the past");
  }

  // Check for overlapping pending/approved leave applications
  const overlapping = await prisma.leaveApplication.findFirst({
    where: {
      studentId,
      status: { in: ["pending", "approved"] },
      OR: [
        {
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
      ],
    },
  });

  if (overlapping) {
    throw new BadRequestError("A leave application already exists for the selected dates");
  }

  const totalDays = calculateTotalDays(startDate, endDate);

  const leave = await prisma.leaveApplication.create({
    data: {
      orgId,
      branchId,
      studentId,
      parentId,
      type: input.type,
      reason: input.reason,
      startDate,
      endDate,
      totalDays,
      status: "pending",
    },
    include: {
      student: {
        select: {
          firstName: true,
          lastName: true,
          batch: { select: { id: true, name: true } },
        },
      },
    },
  });

  return {
    id: leave.id,
    type: leave.type,
    reason: leave.reason,
    startDate: leave.startDate.toISOString().split("T")[0],
    endDate: leave.endDate.toISOString().split("T")[0],
    totalDays: leave.totalDays,
    status: leave.status,
    createdAt: leave.createdAt,
    studentName: formatFullName(leave.student.firstName, leave.student.lastName),
    batchName: leave.student.batch?.name ?? null,
  };
}

/**
 * Get leave applications for a student (parent view)
 */
export async function getStudentLeaveApplications(
  parentContext: ParentContext,
  studentId: string,
  pagination: PaginationParams
) {
  const { parentId } = parentContext;

  // Verify parent is linked to this student
  const link = await prisma.studentParent.findUnique({
    where: {
      studentId_parentId: { studentId, parentId },
    },
  });

  if (!link) {
    throw new ForbiddenError("You do not have access to this student");
  }

  const where: Prisma.LeaveApplicationWhereInput = { studentId };

  const [applications, total] = await Promise.all([
    prisma.leaveApplication.findMany({
      where,
      include: {
        reviewedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: calculateSkip(pagination),
      take: pagination.limit,
    }),
    prisma.leaveApplication.count({ where }),
  ]);

  const formatted = applications.map((app) => ({
    id: app.id,
    type: app.type,
    reason: app.reason,
    startDate: app.startDate.toISOString().split("T")[0],
    endDate: app.endDate.toISOString().split("T")[0],
    totalDays: app.totalDays,
    status: app.status,
    reviewedBy: app.reviewedBy
      ? {
          id: app.reviewedBy.id,
          name: formatFullName(app.reviewedBy.firstName, app.reviewedBy.lastName),
        }
      : null,
    reviewedAt: app.reviewedAt?.toISOString() ?? null,
    reviewNote: app.reviewNote,
    createdAt: app.createdAt.toISOString(),
  }));

  return createPaginatedResponse(formatted, total, pagination);
}

/**
 * Cancel a pending leave application (parent)
 */
export async function cancelLeaveApplication(
  parentContext: ParentContext,
  leaveId: string
) {
  const { parentId } = parentContext;

  const leave = await prisma.leaveApplication.findFirst({
    where: {
      id: leaveId,
      parentId,
    },
  });

  if (!leave) {
    throw new NotFoundError("Leave application");
  }

  if (leave.status !== "pending") {
    throw new BadRequestError("Can only cancel pending leave applications");
  }

  await prisma.leaveApplication.update({
    where: { id: leaveId },
    data: { status: "cancelled" },
  });

  return { success: true, message: "Leave application cancelled" };
}

// ============================================================================
// Staff Functions
// ============================================================================

/**
 * Get all leave applications (staff view)
 */
export async function getLeaveApplications(
  scope: TenantScope,
  filters: LeaveFilters,
  pagination: PaginationParams
) {
  const where: Prisma.LeaveApplicationWhereInput = {
    orgId: scope.orgId,
    branchId: scope.branchId,
  };

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.studentId) {
    where.studentId = filters.studentId;
  }

  if (filters.batchId) {
    where.student = { batchId: filters.batchId };
  }

  if (filters.startDate || filters.endDate) {
    if (filters.startDate) {
      where.startDate = { gte: new Date(filters.startDate) };
    }
    if (filters.endDate) {
      where.endDate = { lte: new Date(filters.endDate) };
    }
  }

  const [applications, total] = await Promise.all([
    prisma.leaveApplication.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            batch: { select: { id: true, name: true } },
          },
        },
        parent: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        reviewedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: calculateSkip(pagination),
      take: pagination.limit,
    }),
    prisma.leaveApplication.count({ where }),
  ]);

  const formatted = applications.map((app) => ({
    id: app.id,
    type: app.type,
    reason: app.reason,
    startDate: app.startDate.toISOString().split("T")[0],
    endDate: app.endDate.toISOString().split("T")[0],
    totalDays: app.totalDays,
    status: app.status,
    student: {
      id: app.student.id,
      name: formatFullName(app.student.firstName, app.student.lastName),
      batchId: app.student.batch?.id ?? null,
      batchName: app.student.batch?.name ?? null,
    },
    parent: {
      id: app.parent.id,
      name: formatFullName(app.parent.firstName, app.parent.lastName),
      phone: app.parent.phone,
    },
    reviewedBy: app.reviewedBy
      ? {
          id: app.reviewedBy.id,
          name: formatFullName(app.reviewedBy.firstName, app.reviewedBy.lastName),
        }
      : null,
    reviewedAt: app.reviewedAt?.toISOString() ?? null,
    reviewNote: app.reviewNote,
    createdAt: app.createdAt.toISOString(),
  }));

  return createPaginatedResponse(formatted, total, pagination);
}

/**
 * Get a single leave application
 */
export async function getLeaveApplication(scope: TenantScope, leaveId: string) {
  const leave = await prisma.leaveApplication.findFirst({
    where: {
      id: leaveId,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          batch: { select: { id: true, name: true } },
        },
      },
      parent: {
        select: { id: true, firstName: true, lastName: true, phone: true },
      },
      reviewedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  if (!leave) {
    throw new NotFoundError("Leave application");
  }

  return {
    id: leave.id,
    type: leave.type,
    reason: leave.reason,
    startDate: leave.startDate.toISOString().split("T")[0],
    endDate: leave.endDate.toISOString().split("T")[0],
    totalDays: leave.totalDays,
    status: leave.status,
    student: {
      id: leave.student.id,
      name: formatFullName(leave.student.firstName, leave.student.lastName),
      batchId: leave.student.batch?.id ?? null,
      batchName: leave.student.batch?.name ?? null,
    },
    parent: {
      id: leave.parent.id,
      name: formatFullName(leave.parent.firstName, leave.parent.lastName),
      phone: leave.parent.phone,
    },
    reviewedBy: leave.reviewedBy
      ? {
          id: leave.reviewedBy.id,
          name: formatFullName(leave.reviewedBy.firstName, leave.reviewedBy.lastName),
        }
      : null,
    reviewedAt: leave.reviewedAt?.toISOString() ?? null,
    reviewNote: leave.reviewNote,
    createdAt: leave.createdAt.toISOString(),
  };
}

/**
 * Review (approve/reject) a leave application
 */
export async function reviewLeaveApplication(
  scope: TenantScope,
  leaveId: string,
  userId: string,
  input: ReviewLeaveInput
) {
  const leave = await prisma.leaveApplication.findFirst({
    where: {
      id: leaveId,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!leave) {
    throw new NotFoundError("Leave application");
  }

  if (leave.status !== "pending") {
    throw new BadRequestError("Can only review pending leave applications");
  }

  const updated = await prisma.leaveApplication.update({
    where: { id: leaveId },
    data: {
      status: input.status,
      reviewedById: userId,
      reviewedAt: new Date(),
      reviewNote: input.reviewNote,
    },
    include: {
      student: {
        select: {
          firstName: true,
          lastName: true,
          batch: { select: { id: true, name: true } },
        },
      },
    },
  });

  return {
    id: updated.id,
    status: updated.status,
    reviewedAt: updated.reviewedAt?.toISOString() ?? null,
    reviewNote: updated.reviewNote,
    studentName: formatFullName(updated.student.firstName, updated.student.lastName),
    batchName: updated.student.batch?.name ?? null,
  };
}

/**
 * Get students on approved leave for a specific date and batch
 * Used by attendance service to show leave indicators
 */
export async function getStudentsOnLeave(
  scope: TenantScope,
  batchId: string,
  date: string
): Promise<Map<string, { type: StudentLeaveType; startDate: string; endDate: string }>> {
  const targetDate = new Date(date);

  const leaves = await prisma.leaveApplication.findMany({
    where: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      status: "approved",
      student: { batchId },
      startDate: { lte: targetDate },
      endDate: { gte: targetDate },
    },
    select: {
      studentId: true,
      type: true,
      startDate: true,
      endDate: true,
    },
  });

  const leaveMap = new Map<string, { type: StudentLeaveType; startDate: string; endDate: string }>();
  for (const leave of leaves) {
    leaveMap.set(leave.studentId, {
      type: leave.type,
      startDate: leave.startDate.toISOString().split("T")[0],
      endDate: leave.endDate.toISOString().split("T")[0],
    });
  }

  return leaveMap;
}

/**
 * Get leave application stats for dashboard
 */
export async function getLeaveStats(scope: TenantScope) {
  const [pending, approvedThisMonth, totalThisMonth] = await Promise.all([
    prisma.leaveApplication.count({
      where: {
        orgId: scope.orgId,
        branchId: scope.branchId,
        status: "pending",
      },
    }),
    prisma.leaveApplication.count({
      where: {
        orgId: scope.orgId,
        branchId: scope.branchId,
        status: "approved",
        reviewedAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
    prisma.leaveApplication.count({
      where: {
        orgId: scope.orgId,
        branchId: scope.branchId,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
  ]);

  return {
    pending,
    approvedThisMonth,
    totalThisMonth,
  };
}
