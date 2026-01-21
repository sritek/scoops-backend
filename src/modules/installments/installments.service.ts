import type { Prisma, InstallmentStatus as PrismaInstallmentStatus } from "@prisma/client";
import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import { NotFoundError, BadRequestError } from "../../utils/error-handler.js";
import {
  type PaginationParams,
  createPaginatedResponse,
  calculateSkip,
} from "../../utils/pagination.js";
import type {
  CreateEMIPlanTemplateInput,
  UpdateEMIPlanTemplateInput,
  GenerateInstallmentsInput,
  RecordInstallmentPaymentInput,
  PendingInstallmentsFilters,
  EMISplitConfig,
} from "./installments.schema.js";

// =====================
// EMI Plan Templates
// =====================

/**
 * Get all EMI plan templates for an organization
 */
export async function getEMIPlanTemplates(scope: TenantScope) {
  return prisma.eMIPlanTemplate.findMany({
    where: {
      orgId: scope.orgId,
      isActive: true,
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

/**
 * Get EMI plan template by ID
 */
export async function getEMIPlanTemplateById(id: string, scope: TenantScope) {
  const template = await prisma.eMIPlanTemplate.findFirst({
    where: {
      id,
      orgId: scope.orgId,
    },
  });

  if (!template) {
    throw new NotFoundError("EMI plan template");
  }

  return template;
}

/**
 * Create EMI plan template
 */
export async function createEMIPlanTemplate(
  input: CreateEMIPlanTemplateInput,
  scope: TenantScope
) {
  // Check for duplicate name
  const existing = await prisma.eMIPlanTemplate.findFirst({
    where: {
      orgId: scope.orgId,
      name: input.name,
    },
  });

  if (existing) {
    throw new BadRequestError(`An EMI plan template with name "${input.name}" already exists`);
  }

  // Validate split config sums to 100%
  const totalPercent = (input.splitConfig as EMISplitConfig).reduce(
    (sum, s) => sum + s.percent,
    0
  );
  if (totalPercent !== 100) {
    throw new BadRequestError("Split percentages must sum to 100%");
  }

  // If setting as default, unset other defaults
  if (input.isDefault) {
    await prisma.eMIPlanTemplate.updateMany({
      where: {
        orgId: scope.orgId,
        isDefault: true,
      },
      data: { isDefault: false },
    });
  }

  return prisma.eMIPlanTemplate.create({
    data: {
      orgId: scope.orgId,
      name: input.name,
      installmentCount: input.installmentCount,
      splitConfig: input.splitConfig,
      isDefault: input.isDefault,
    },
  });
}

/**
 * Update EMI plan template
 */
export async function updateEMIPlanTemplate(
  id: string,
  input: UpdateEMIPlanTemplateInput,
  scope: TenantScope
) {
  const existing = await prisma.eMIPlanTemplate.findFirst({
    where: {
      id,
      orgId: scope.orgId,
    },
  });

  if (!existing) {
    throw new NotFoundError("EMI plan template");
  }

  // Check for duplicate name
  if (input.name && input.name !== existing.name) {
    const duplicate = await prisma.eMIPlanTemplate.findFirst({
      where: {
        orgId: scope.orgId,
        name: input.name,
        id: { not: id },
      },
    });

    if (duplicate) {
      throw new BadRequestError(`An EMI plan template with name "${input.name}" already exists`);
    }
  }

  // Validate split config if provided
  if (input.splitConfig) {
    const totalPercent = (input.splitConfig as EMISplitConfig).reduce(
      (sum, s) => sum + s.percent,
      0
    );
    if (totalPercent !== 100) {
      throw new BadRequestError("Split percentages must sum to 100%");
    }
  }

  // If setting as default, unset other defaults
  if (input.isDefault) {
    await prisma.eMIPlanTemplate.updateMany({
      where: {
        orgId: scope.orgId,
        isDefault: true,
        id: { not: id },
      },
      data: { isDefault: false },
    });
  }

  return prisma.eMIPlanTemplate.update({
    where: { id },
    data: {
      name: input.name,
      splitConfig: input.splitConfig,
      isDefault: input.isDefault,
      isActive: input.isActive,
    },
  });
}

// =====================
// Installments
// =====================

/**
 * Generate installments for a student fee structure
 */
export async function generateInstallments(
  input: GenerateInstallmentsInput,
  scope: TenantScope
) {
  // Verify fee structure exists and belongs to tenant
  const feeStructure = await prisma.studentFeeStructure.findFirst({
    where: {
      id: input.studentFeeStructureId,
      student: {
        orgId: scope.orgId,
        branchId: scope.branchId,
      },
    },
    include: {
      installments: true,
    },
  });

  if (!feeStructure) {
    throw new NotFoundError("Student fee structure");
  }

  // Check if installments already exist
  if (feeStructure.installments.length > 0) {
    throw new BadRequestError(
      "Installments already exist for this fee structure. Delete existing installments first."
    );
  }

  // Get EMI template
  const template = await prisma.eMIPlanTemplate.findFirst({
    where: {
      id: input.emiTemplateId,
      orgId: scope.orgId,
      isActive: true,
    },
  });

  if (!template) {
    throw new NotFoundError("EMI plan template");
  }

  const splitConfig = template.splitConfig as EMISplitConfig;
  const startDate = new Date(input.startDate);
  const netAmount = feeStructure.netAmount;

  // Generate installments
  const installmentsData = splitConfig.map((split, index) => {
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + split.dueDaysFromStart);

    const amount = Math.round((netAmount * split.percent) / 100);

    return {
      studentFeeStructureId: input.studentFeeStructureId,
      installmentNumber: index + 1,
      amount,
      dueDate,
      paidAmount: 0,
      status: "upcoming" as PrismaInstallmentStatus,
    };
  });

  // Adjust for rounding errors - add/subtract from last installment
  const totalInstallmentAmount = installmentsData.reduce((sum, i) => sum + i.amount, 0);
  if (totalInstallmentAmount !== netAmount) {
    installmentsData[installmentsData.length - 1].amount += netAmount - totalInstallmentAmount;
  }

  // Create installments
  await prisma.feeInstallment.createMany({
    data: installmentsData,
  });

  // Return the created installments
  return prisma.feeInstallment.findMany({
    where: {
      studentFeeStructureId: input.studentFeeStructureId,
    },
    orderBy: {
      installmentNumber: "asc",
    },
  });
}

/**
 * Get installments for a student fee structure
 */
export async function getStudentInstallments(
  studentId: string,
  sessionId: string | undefined,
  scope: TenantScope
) {
  // Verify student belongs to tenant
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!student) {
    throw new NotFoundError("Student");
  }

  const where: Prisma.StudentFeeStructureWhereInput = {
    studentId,
  };

  if (sessionId) {
    where.sessionId = sessionId;
  }

  const feeStructures = await prisma.studentFeeStructure.findMany({
    where,
    include: {
      session: {
        select: {
          id: true,
          name: true,
          isCurrent: true,
        },
      },
      installments: {
        include: {
          payments: {
            orderBy: {
              receivedAt: "desc",
            },
          },
        },
        orderBy: {
          installmentNumber: "asc",
        },
      },
    },
    orderBy: {
      session: {
        name: "desc",
      },
    },
  });

  return feeStructures.map((fs) => ({
    sessionId: fs.sessionId,
    session: fs.session,
    netAmount: fs.netAmount,
    installments: fs.installments,
  }));
}

/**
 * Record payment for an installment
 */
export async function recordInstallmentPayment(
  input: RecordInstallmentPaymentInput,
  userId: string,
  scope: TenantScope
) {
  // Get the installment
  const installment = await prisma.feeInstallment.findFirst({
    where: {
      id: input.installmentId,
      studentFeeStructure: {
        student: {
          orgId: scope.orgId,
          branchId: scope.branchId,
        },
      },
    },
  });

  if (!installment) {
    throw new NotFoundError("Installment");
  }

  // Check if payment would exceed amount
  const newPaidAmount = installment.paidAmount + input.amount;
  if (newPaidAmount > installment.amount) {
    throw new BadRequestError(
      `Payment amount exceeds pending amount. Maximum allowed: ${installment.amount - installment.paidAmount}`
    );
  }

  // Determine new status
  let newStatus: PrismaInstallmentStatus;
  if (newPaidAmount >= installment.amount) {
    newStatus = "paid";
  } else if (newPaidAmount > 0) {
    newStatus = "partial";
  } else {
    newStatus = installment.status;
  }

  // Use transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create payment record
    const payment = await tx.installmentPayment.create({
      data: {
        installmentId: input.installmentId,
        amount: input.amount,
        paymentMode: input.paymentMode,
        transactionRef: input.transactionRef,
        receivedById: userId,
        remarks: input.remarks,
      },
    });

    // Update installment
    const updatedInstallment = await tx.feeInstallment.update({
      where: { id: input.installmentId },
      data: {
        paidAmount: newPaidAmount,
        status: newStatus,
      },
      include: {
        studentFeeStructure: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return { payment, installment: updatedInstallment };
  });

  return result;
}

/**
 * Get pending installments with pagination
 */
export async function getPendingInstallments(
  scope: TenantScope,
  pagination: PaginationParams,
  filters?: PendingInstallmentsFilters
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const where: Prisma.FeeInstallmentWhereInput = {
    studentFeeStructure: {
      student: {
        orgId: scope.orgId,
        branchId: scope.branchId,
        status: "active",
      },
    },
    status: { not: "paid" },
  };

  // Add status filter
  if (filters?.status) {
    where.status = filters.status;
  }

  // Add batch filter
  if (filters?.batchId) {
    const studentFeeStructure = where.studentFeeStructure as Prisma.StudentFeeStructureWhereInput;
    const currentStudent = studentFeeStructure.student ?? {};
    studentFeeStructure.student = {
      ...(currentStudent as object),
      batchId: filters.batchId,
    };
  }

  const [installments, total] = await Promise.all([
    prisma.feeInstallment.findMany({
      where,
      include: {
        studentFeeStructure: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                batch: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            session: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ dueDate: "asc" }, { installmentNumber: "asc" }],
      skip: calculateSkip(pagination),
      take: pagination.limit,
    }),
    prisma.feeInstallment.count({ where }),
  ]);

  // Format response
  const formattedInstallments = installments.map((inst) => ({
    id: inst.id,
    installmentNumber: inst.installmentNumber,
    amount: inst.amount,
    paidAmount: inst.paidAmount,
    pendingAmount: inst.amount - inst.paidAmount,
    dueDate: inst.dueDate,
    status: inst.status,
    student: {
      id: inst.studentFeeStructure.student.id,
      fullName: `${inst.studentFeeStructure.student.firstName} ${inst.studentFeeStructure.student.lastName}`,
      batch: inst.studentFeeStructure.student.batch,
    },
    session: inst.studentFeeStructure.session,
  }));

  return createPaginatedResponse(formattedInstallments, total, pagination);
}

/**
 * Update installment statuses based on due dates
 * Called by scheduler job
 */
export async function updateInstallmentStatuses() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Update upcoming to due if due date is today
  await prisma.feeInstallment.updateMany({
    where: {
      status: "upcoming",
      dueDate: {
        lte: today,
      },
    },
    data: {
      status: "due",
    },
  });

  // Update due to overdue if past due date
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  await prisma.feeInstallment.updateMany({
    where: {
      status: "due",
      dueDate: {
        lt: today,
      },
    },
    data: {
      status: "overdue",
    },
  });

  // Also update partial payments that are overdue
  await prisma.feeInstallment.updateMany({
    where: {
      status: "partial",
      dueDate: {
        lt: today,
      },
    },
    data: {
      status: "overdue",
    },
  });
}

/**
 * Delete installments for a fee structure
 */
export async function deleteInstallments(
  studentFeeStructureId: string,
  scope: TenantScope
) {
  // Verify structure belongs to tenant
  const structure = await prisma.studentFeeStructure.findFirst({
    where: {
      id: studentFeeStructureId,
      student: {
        orgId: scope.orgId,
        branchId: scope.branchId,
      },
    },
    include: {
      installments: {
        include: {
          payments: true,
        },
      },
    },
  });

  if (!structure) {
    throw new NotFoundError("Student fee structure");
  }

  // Check if any payments have been made
  const hasPayments = structure.installments.some((i) => i.payments.length > 0);
  if (hasPayments) {
    throw new BadRequestError(
      "Cannot delete installments that have payments recorded. Contact support for assistance."
    );
  }

  // Delete installments
  await prisma.feeInstallment.deleteMany({
    where: { studentFeeStructureId },
  });

  return { success: true };
}
