import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import { NotFoundError, BadRequestError } from "../../utils/error-handler.js";
import type {
  CreateStudentFeeStructureInput,
  UpdateStudentFeeStructureInput,
} from "./student-fee-structure.schema.js";
import { recalculateStudentFeeStructure } from "../scholarships/scholarships.service.js";

/**
 * Get student fee structure by student ID and session
 */
export async function getStudentFeeStructure(
  studentId: string,
  sessionId: string,
  scope: TenantScope,
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

  const structure = await prisma.studentFeeStructure.findFirst({
    where: {
      studentId,
      sessionId,
    },
    include: {
      lineItems: {
        include: {
          feeComponent: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
        orderBy: {
          feeComponent: {
            type: "asc",
          },
        },
      },
      batchFeeStructure: {
        select: {
          id: true,
          name: true,
          totalAmount: true,
        },
      },
      session: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return structure;
}

/**
 * Get student fee structure by ID
 */
export async function getStudentFeeStructureById(
  id: string,
  scope: TenantScope,
) {
  const structure = await prisma.studentFeeStructure.findFirst({
    where: {
      id,
      student: {
        orgId: scope.orgId,
        branchId: scope.branchId,
      },
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      lineItems: {
        include: {
          feeComponent: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
        orderBy: {
          feeComponent: {
            type: "asc",
          },
        },
      },
      batchFeeStructure: {
        select: {
          id: true,
          name: true,
          totalAmount: true,
        },
      },
      session: {
        select: {
          id: true,
          name: true,
        },
      },
      installments: {
        orderBy: {
          installmentNumber: "asc",
        },
      },
    },
  });

  if (!structure) {
    throw new NotFoundError("Student fee structure");
  }

  return structure;
}

/**
 * Create a custom student fee structure
 */
export async function createStudentFeeStructure(
  input: CreateStudentFeeStructureInput,
  scope: TenantScope,
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

  // Verify session belongs to org
  const session = await prisma.academicSession.findFirst({
    where: {
      id: input.sessionId,
      orgId: scope.orgId,
    },
  });

  if (!session) {
    throw new NotFoundError("Academic session");
  }

  // Check if structure already exists
  const existing = await prisma.studentFeeStructure.findFirst({
    where: {
      studentId: input.studentId,
      sessionId: input.sessionId,
    },
  });

  if (existing) {
    throw new BadRequestError(
      "Fee structure already exists for this student and session. Use update instead.",
    );
  }

  // Verify all fee components belong to org
  const componentIds = input.lineItems.map((li) => li.feeComponentId);
  const components = await prisma.feeComponent.findMany({
    where: {
      id: { in: componentIds },
      orgId: scope.orgId,
      isActive: true,
    },
  });

  if (components.length !== componentIds.length) {
    throw new BadRequestError(
      "One or more fee components are invalid or inactive",
    );
  }

  // Calculate amounts
  const grossAmount = input.lineItems.reduce(
    (sum, li) => sum + li.adjustedAmount,
    0,
  );

  // Get any existing scholarships
  const scholarships = await prisma.studentScholarship.findMany({
    where: {
      studentId: input.studentId,
      sessionId: input.sessionId,
      isActive: true,
    },
    include: {
      scholarship: true,
    },
  });

  // Calculate scholarship discount (simplified - full calculation happens in recalculate)
  let scholarshipAmount = 0;
  for (const ss of scholarships) {
    if (ss.scholarship.type === "percentage") {
      const discount = Math.round((grossAmount * ss.scholarship.value) / 100);
      scholarshipAmount += ss.scholarship.maxAmount
        ? Math.min(discount, ss.scholarship.maxAmount)
        : discount;
    } else if (ss.scholarship.type === "fixed_amount") {
      scholarshipAmount += ss.scholarship.value;
    } else if (
      ss.scholarship.type === "component_waiver" &&
      ss.scholarship.componentId
    ) {
      const lineItem = input.lineItems.find(
        (li) => li.feeComponentId === ss.scholarship.componentId,
      );
      scholarshipAmount += lineItem?.adjustedAmount ?? 0;
    }
  }

  const netAmount = Math.max(0, grossAmount - scholarshipAmount);

  const structure = await prisma.studentFeeStructure.create({
    data: {
      studentId: input.studentId,
      sessionId: input.sessionId,
      source: "custom",
      grossAmount,
      scholarshipAmount,
      netAmount,
      remarks: input.remarks,
      lineItems: {
        create: input.lineItems.map((li) => ({
          feeComponentId: li.feeComponentId,
          originalAmount: li.originalAmount,
          adjustedAmount: li.adjustedAmount,
          waived: li.waived,
          waiverReason: li.waiverReason,
        })),
      },
    },
    include: {
      lineItems: {
        include: {
          feeComponent: {
            select: {
              id: true,
              name: true,
              type: true,
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
  });

  // Recalculate with proper scholarship logic
  if (scholarships.length > 0) {
    await recalculateStudentFeeStructure(input.studentId, input.sessionId);
  }

  return structure;
}

/**
 * Update student fee structure
 */
export async function updateStudentFeeStructure(
  id: string,
  input: UpdateStudentFeeStructureInput,
  scope: TenantScope,
) {
  const existing = await prisma.studentFeeStructure.findFirst({
    where: {
      id,
      student: {
        orgId: scope.orgId,
        branchId: scope.branchId,
      },
    },
  });

  if (!existing) {
    throw new NotFoundError("Student fee structure");
  }

  let grossAmount = existing.grossAmount;

  // If updating line items
  if (input.lineItems) {
    // Verify all fee components belong to org
    const componentIds = input.lineItems.map((li) => li.feeComponentId);
    const components = await prisma.feeComponent.findMany({
      where: {
        id: { in: componentIds },
        orgId: scope.orgId,
        isActive: true,
      },
    });

    if (components.length !== componentIds.length) {
      throw new BadRequestError(
        "One or more fee components are invalid or inactive",
      );
    }

    grossAmount = input.lineItems.reduce(
      (sum, li) => sum + li.adjustedAmount,
      0,
    );

    // Delete existing line items
    await prisma.studentFeeLineItem.deleteMany({
      where: { studentFeeStructureId: id },
    });
  }

  const structure = await prisma.studentFeeStructure.update({
    where: { id },
    data: {
      source: "custom", // Mark as custom since we're modifying it
      grossAmount: input.lineItems ? grossAmount : undefined,
      remarks: input.remarks,
      ...(input.lineItems && {
        lineItems: {
          create: input.lineItems.map((li) => ({
            feeComponentId: li.feeComponentId,
            originalAmount: li.originalAmount,
            adjustedAmount: li.adjustedAmount,
            waived: li.waived,
            waiverReason: li.waiverReason,
          })),
        },
      }),
    },
    include: {
      lineItems: {
        include: {
          feeComponent: {
            select: {
              id: true,
              name: true,
              type: true,
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
  });

  // Recalculate scholarships if line items changed
  if (input.lineItems) {
    await recalculateStudentFeeStructure(
      existing.studentId,
      existing.sessionId,
    );
  }

  return structure;
}

/**
 * Get all student fee structures for a session (admin view)
 */
export async function getAllStudentFeeStructures(
  sessionId: string,
  scope: TenantScope,
) {
  return prisma.studentFeeStructure.findMany({
    where: {
      sessionId,
      student: {
        orgId: scope.orgId,
        branchId: scope.branchId,
        status: "active",
      },
    },
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
      _count: {
        select: {
          installments: true,
        },
      },
    },
    orderBy: [
      { student: { batch: { name: "asc" } } },
      { student: { firstName: "asc" } },
    ],
  });
}

/**
 * Get student fee summary for dashboard
 */
export async function getStudentFeeSummary(
  studentId: string,
  sessionId: string | undefined,
  scope: TenantScope,
) {
  // Verify student belongs to tenant
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!student) {
    throw new NotFoundError("Student");
  }

  const where: {
    studentId: string;
    sessionId?: string;
  } = { studentId };

  if (sessionId) {
    where.sessionId = sessionId;
  }

  const structures = await prisma.studentFeeStructure.findMany({
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
        select: {
          id: true,
          amount: true,
          paidAmount: true,
          status: true,
          dueDate: true,
        },
        orderBy: {
          dueDate: "asc",
        },
      },
      _count: {
        select: {
          lineItems: true,
        },
      },
    },
    orderBy: {
      session: {
        name: "desc",
      },
    },
  });

  // Calculate totals
  const summary = structures.map((structure) => {
    const totalInstallments = structure.installments.length;
    const paidInstallments = structure.installments.filter(
      (i) => i.status === "paid",
    ).length;
    const totalPaid = structure.installments.reduce(
      (sum, i) => sum + i.paidAmount,
      0,
    );
    const pendingAmount = structure.netAmount - totalPaid;
    const nextDueInstallment = structure.installments.find(
      (i) => i.status !== "paid",
    );

    // Build custom discount object if present
    const customDiscount =
      structure.customDiscountType &&
      structure.customDiscountValue !== null &&
      structure.customDiscountAmount !== null
        ? {
            type: structure.customDiscountType as "percentage" | "fixed_amount",
            value: structure.customDiscountValue,
            amount: structure.customDiscountAmount,
            remarks: structure.customDiscountRemarks,
          }
        : null;

    return {
      id: structure.id,
      session: structure.session,
      grossAmount: structure.grossAmount,
      scholarshipAmount: structure.scholarshipAmount,
      customDiscount,
      netAmount: structure.netAmount,
      totalPaid,
      pendingAmount: Math.max(0, pendingAmount),
      totalInstallments,
      paidInstallments,
      nextDue: nextDueInstallment
        ? {
            amount: nextDueInstallment.amount - nextDueInstallment.paidAmount,
            dueDate: nextDueInstallment.dueDate,
          }
        : null,
    };
  });

  return {
    student: {
      id: student.id,
      fullName: `${student.firstName} ${student.lastName}`,
    },
    feeStructures: summary,
  };
}
