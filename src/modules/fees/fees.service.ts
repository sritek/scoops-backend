import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import { NotFoundError, BadRequestError } from "../../utils/error-handler.js";
import {
  type PaginationParams,
  createPaginatedResponse,
  calculateSkip,
} from "../../utils/pagination.js";
import { emitEvent, EVENT_TYPES } from "../events/index.js";
import type {
  CreateFeePlanInput,
  AssignFeeInput,
  RecordPaymentInput,
  PendingFeesFilters,
  FeePlansFilters,
} from "./fees.schema.js";

/**
 * Helper to format full name
 */
function formatFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/**
 * Get fee plans for a branch with pagination
 */
export async function getFeePlans(
  scope: TenantScope,
  pagination: PaginationParams,
  filters?: FeePlansFilters
) {
  const where: Prisma.FeePlanWhereInput = {
    orgId: scope.orgId,
    branchId: scope.branchId,
  };

  // Add isActive filter (defaults to true if not specified)
  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive;
  } else {
    where.isActive = true; // Default to showing only active fee plans
  }

  const [feePlans, total] = await Promise.all([
    prisma.feePlan.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: calculateSkip(pagination),
      take: pagination.limit,
    }),
    prisma.feePlan.count({ where }),
  ]);

  return createPaginatedResponse(feePlans, total, pagination);
}

/**
 * Create a new fee plan
 */
export async function createFeePlan(
  input: CreateFeePlanInput,
  scope: TenantScope
) {
  return prisma.feePlan.create({
    data: {
      name: input.name,
      amount: input.amount,
      frequency: input.frequency,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });
}

/**
 * Get pending fees for a branch with pagination
 */
export async function getPendingFees(
  scope: TenantScope,
  pagination: PaginationParams,
  filters?: PendingFeesFilters
) {
  // Build where clause
  const where: Prisma.StudentFeeWhereInput = {
    student: {
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  };

  // Add status filter (defaults to pending and partial)
  if (filters?.status) {
    where.status = filters.status;
  } else {
    where.status = { in: ["pending", "partial"] };
  }

  // Add student filter
  if (filters?.studentId) {
    where.studentId = filters.studentId;
  }

  const [fees, total] = await Promise.all([
    prisma.studentFee.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        feePlan: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { dueDate: "asc" },
      skip: calculateSkip(pagination),
      take: pagination.limit,
    }),
    prisma.studentFee.count({ where }),
  ]);

  const formattedFees = fees.map((fee) => ({
    id: fee.id,
    student: {
      id: fee.student.id,
      firstName: fee.student.firstName,
      lastName: fee.student.lastName,
      fullName: formatFullName(fee.student.firstName, fee.student.lastName),
    },
    feePlan: fee.feePlan,
    dueDate: fee.dueDate,
    totalAmount: fee.totalAmount,
    paidAmount: fee.paidAmount,
    pendingAmount: fee.totalAmount - fee.paidAmount,
    status: fee.status,
  }));

  return createPaginatedResponse(formattedFees, total, pagination);
}

/**
 * Get fee details for a student
 */
export async function getStudentFees(studentId: string, scope: TenantScope) {
  // Verify student belongs to tenant
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!student) return null;

  const fees = await prisma.studentFee.findMany({
    where: {
      studentId,
    },
    include: {
      feePlan: {
        select: {
          id: true,
          name: true,
        },
      },
      payments: {
        orderBy: {
          receivedAt: "desc",
        },
        include: {
          receivedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
    orderBy: {
      dueDate: "desc",
    },
  });

  return {
    student: {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      fullName: formatFullName(student.firstName, student.lastName),
    },
    fees: fees.map((fee) => ({
      id: fee.id,
      feePlan: fee.feePlan,
      dueDate: fee.dueDate,
      totalAmount: fee.totalAmount,
      paidAmount: fee.paidAmount,
      pendingAmount: fee.totalAmount - fee.paidAmount,
      status: fee.status,
      payments: fee.payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        paymentMode: p.paymentMode,
        receivedAt: p.receivedAt,
        receivedBy: {
          id: p.receivedBy.id,
          firstName: p.receivedBy.firstName,
          lastName: p.receivedBy.lastName,
          fullName: formatFullName(p.receivedBy.firstName, p.receivedBy.lastName),
        },
      })),
    })),
  };
}

/**
 * Assign a fee to a student
 */
export async function assignFee(
  input: AssignFeeInput,
  userId: string,
  scope: TenantScope
) {
  // Verify student belongs to tenant
  const student = await prisma.student.findFirst({
    where: {
      id: input.studentId,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!student) {
    throw new NotFoundError("Student");
  }

  // Verify fee plan belongs to tenant
  const feePlan = await prisma.feePlan.findFirst({
    where: {
      id: input.feePlanId,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!feePlan) {
    throw new NotFoundError("Fee plan");
  }

  // Check for duplicate fee assignment (same student, same fee plan, same due date)
  const existingFee = await prisma.studentFee.findFirst({
    where: {
      studentId: input.studentId,
      feePlanId: input.feePlanId,
      dueDate: new Date(input.dueDate),
    },
  });

  if (existingFee) {
    throw new BadRequestError(
      `This fee plan is already assigned to the student for the due date ${input.dueDate}`
    );
  }

  const totalAmount = input.totalAmount ?? feePlan.amount;

  const studentFee = await prisma.studentFee.create({
    data: {
      studentId: input.studentId,
      feePlanId: input.feePlanId,
      dueDate: new Date(input.dueDate),
      totalAmount,
      paidAmount: 0,
      status: "pending",
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      feePlan: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Emit fee.created event
  await emitEvent(EVENT_TYPES.FEE_CREATED, scope.orgId, scope.branchId, {
    entityType: "student_fee",
    entityId: studentFee.id,
    data: {
      studentId: input.studentId,
      feePlanId: input.feePlanId,
      totalAmount,
      dueDate: input.dueDate,
      createdBy: userId,
    },
  });

  return {
    ...studentFee,
    student: {
      id: studentFee.student.id,
      firstName: studentFee.student.firstName,
      lastName: studentFee.student.lastName,
      fullName: formatFullName(studentFee.student.firstName, studentFee.student.lastName),
    },
  };
}

/**
 * Record a payment for a student fee
 */
export async function recordPayment(
  input: RecordPaymentInput,
  userId: string,
  scope: TenantScope
) {
  // Get the student fee with student for tenant validation
  const studentFee = await prisma.studentFee.findFirst({
    where: {
      id: input.studentFeeId,
      student: {
        orgId: scope.orgId,
        branchId: scope.branchId,
      },
    },
    include: {
      student: true,
    },
  });

  if (!studentFee) {
    throw new NotFoundError("Fee record");
  }

  // Check if payment would exceed total
  const newPaidAmount = studentFee.paidAmount + input.amount;
  if (newPaidAmount > studentFee.totalAmount) {
    throw new BadRequestError(
      `Payment amount exceeds pending amount. Maximum allowed: ${studentFee.totalAmount - studentFee.paidAmount}`
    );
  }

  // Determine new status
  let newStatus: "pending" | "partial" | "paid";
  if (newPaidAmount >= studentFee.totalAmount) {
    newStatus = "paid";
  } else if (newPaidAmount > 0) {
    newStatus = "partial";
  } else {
    newStatus = "pending";
  }

  // Use transaction for atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Create payment record
    const payment = await tx.feePayment.create({
      data: {
        studentFeeId: input.studentFeeId,
        amount: input.amount,
        paymentMode: input.paymentMode,
        receivedById: userId,
        receivedAt: new Date(),
      },
    });

    // Update student fee
    const updatedFee = await tx.studentFee.update({
      where: { id: input.studentFeeId },
      data: {
        paidAmount: newPaidAmount,
        status: newStatus,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        feePlan: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return { payment, updatedFee };
  });

  // Emit fee.paid event
  await emitEvent(EVENT_TYPES.FEE_PAID, scope.orgId, scope.branchId, {
    entityType: "fee_payment",
    entityId: result.payment.id,
    data: {
      studentFeeId: input.studentFeeId,
      studentId: studentFee.studentId,
      amount: input.amount,
      paymentMode: input.paymentMode,
      newPaidAmount,
      newStatus,
      receivedBy: userId,
    },
  });

  return {
    payment: result.payment,
    fee: {
      id: result.updatedFee.id,
      student: {
        id: result.updatedFee.student.id,
        firstName: result.updatedFee.student.firstName,
        lastName: result.updatedFee.student.lastName,
        fullName: formatFullName(result.updatedFee.student.firstName, result.updatedFee.student.lastName),
      },
      feePlan: result.updatedFee.feePlan,
      dueDate: result.updatedFee.dueDate,
      totalAmount: result.updatedFee.totalAmount,
      paidAmount: result.updatedFee.paidAmount,
      pendingAmount: result.updatedFee.totalAmount - result.updatedFee.paidAmount,
      status: result.updatedFee.status,
    },
  };
}
