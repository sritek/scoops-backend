import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import { NotFoundError, BadRequestError } from "../../utils/error-handler.js";
import {
  type PaginationParams,
  createPaginatedResponse,
  calculateSkip,
} from "../../utils/pagination.js";
import type {
  CreateScholarshipInput,
  UpdateScholarshipInput,
  AssignScholarshipInput,
  ScholarshipsFilters,
} from "./scholarships.schema.js";

/**
 * Get scholarships for an organization with pagination
 */
export async function getScholarships(
  scope: TenantScope,
  pagination: PaginationParams,
  filters?: ScholarshipsFilters
) {
  const where: Prisma.ScholarshipWhereInput = {
    orgId: scope.orgId,
  };

  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive;
  } else {
    where.isActive = true;
  }

  if (filters?.type) {
    where.type = filters.type;
  }

  if (filters?.basis) {
    where.basis = filters.basis;
  }

  const [scholarships, total] = await Promise.all([
    prisma.scholarship.findMany({
      where,
      include: {
        feeComponent: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: [{ basis: "asc" }, { name: "asc" }],
      skip: calculateSkip(pagination),
      take: pagination.limit,
    }),
    prisma.scholarship.count({ where }),
  ]);

  return createPaginatedResponse(scholarships, total, pagination);
}

/**
 * Get all active scholarships (no pagination, for dropdowns)
 */
export async function getAllScholarships(scope: TenantScope) {
  return prisma.scholarship.findMany({
    where: {
      orgId: scope.orgId,
      isActive: true,
    },
    include: {
      feeComponent: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
    orderBy: [{ basis: "asc" }, { name: "asc" }],
  });
}

/**
 * Get a scholarship by ID
 */
export async function getScholarshipById(id: string, scope: TenantScope) {
  const scholarship = await prisma.scholarship.findFirst({
    where: {
      id,
      orgId: scope.orgId,
    },
    include: {
      feeComponent: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  });

  if (!scholarship) {
    throw new NotFoundError("Scholarship");
  }

  return scholarship;
}

/**
 * Create a new scholarship
 */
export async function createScholarship(
  input: CreateScholarshipInput,
  scope: TenantScope
) {
  // Check for duplicate name
  const existing = await prisma.scholarship.findFirst({
    where: {
      orgId: scope.orgId,
      name: input.name,
    },
  });

  if (existing) {
    throw new BadRequestError(`A scholarship with name "${input.name}" already exists`);
  }

  // If component_waiver, verify component exists
  if (input.type === "component_waiver" && input.componentId) {
    const component = await prisma.feeComponent.findFirst({
      where: {
        id: input.componentId,
        orgId: scope.orgId,
        isActive: true,
      },
    });

    if (!component) {
      throw new NotFoundError("Fee component");
    }
  }

  return prisma.scholarship.create({
    data: {
      orgId: scope.orgId,
      name: input.name,
      type: input.type,
      basis: input.basis,
      value: input.value,
      componentId: input.componentId,
      maxAmount: input.maxAmount,
      description: input.description,
    },
    include: {
      feeComponent: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  });
}

/**
 * Update a scholarship
 */
export async function updateScholarship(
  id: string,
  input: UpdateScholarshipInput,
  scope: TenantScope
) {
  const existing = await prisma.scholarship.findFirst({
    where: {
      id,
      orgId: scope.orgId,
    },
  });

  if (!existing) {
    throw new NotFoundError("Scholarship");
  }

  // Check for duplicate name if updating
  if (input.name && input.name !== existing.name) {
    const duplicate = await prisma.scholarship.findFirst({
      where: {
        orgId: scope.orgId,
        name: input.name,
        id: { not: id },
      },
    });

    if (duplicate) {
      throw new BadRequestError(`A scholarship with name "${input.name}" already exists`);
    }
  }

  return prisma.scholarship.update({
    where: { id },
    data: {
      name: input.name,
      value: input.value,
      maxAmount: input.maxAmount,
      description: input.description,
      isActive: input.isActive,
    },
    include: {
      feeComponent: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  });
}

/**
 * Deactivate a scholarship
 */
export async function deactivateScholarship(id: string, scope: TenantScope) {
  const existing = await prisma.scholarship.findFirst({
    where: {
      id,
      orgId: scope.orgId,
    },
  });

  if (!existing) {
    throw new NotFoundError("Scholarship");
  }

  return prisma.scholarship.update({
    where: { id },
    data: { isActive: false },
  });
}

/**
 * Calculate discount amount based on scholarship type
 */
export function calculateDiscountAmount(
  scholarship: {
    type: string;
    value: number;
    maxAmount: number | null;
  },
  grossAmount: number,
  componentAmount?: number
): number {
  let discount = 0;

  switch (scholarship.type) {
    case "percentage":
      discount = Math.round((grossAmount * scholarship.value) / 100);
      // Apply cap if exists
      if (scholarship.maxAmount && discount > scholarship.maxAmount) {
        discount = scholarship.maxAmount;
      }
      break;
    case "fixed_amount":
      discount = scholarship.value;
      // Cannot exceed gross amount
      if (discount > grossAmount) {
        discount = grossAmount;
      }
      break;
    case "component_waiver":
      // Waive the entire component amount
      discount = componentAmount ?? 0;
      break;
  }

  return discount;
}

/**
 * Assign scholarship to a student
 */
export async function assignScholarship(
  input: AssignScholarshipInput,
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

  // Verify scholarship belongs to org
  const scholarship = await prisma.scholarship.findFirst({
    where: {
      id: input.scholarshipId,
      orgId: scope.orgId,
      isActive: true,
    },
  });

  if (!scholarship) {
    throw new NotFoundError("Scholarship");
  }

  // Verify academic session
  const session = await prisma.academicSession.findFirst({
    where: {
      id: input.sessionId,
      orgId: scope.orgId,
    },
  });

  if (!session) {
    throw new NotFoundError("Academic session");
  }

  // Check if already assigned for this session
  const existing = await prisma.studentScholarship.findFirst({
    where: {
      studentId: input.studentId,
      scholarshipId: input.scholarshipId,
      sessionId: input.sessionId,
    },
  });

  if (existing) {
    throw new BadRequestError(
      "This scholarship is already assigned to the student for this session"
    );
  }

  // Get student's fee structure to calculate discount
  const feeStructure = await prisma.studentFeeStructure.findFirst({
    where: {
      studentId: input.studentId,
      sessionId: input.sessionId,
    },
    include: {
      lineItems: true,
    },
  });

  let discountAmount = 0;

  if (feeStructure) {
    // Calculate discount based on scholarship type
    if (scholarship.type === "component_waiver" && scholarship.componentId) {
      // Find the component amount
      const componentLineItem = feeStructure.lineItems.find(
        (li) => li.feeComponentId === scholarship.componentId
      );
      discountAmount = calculateDiscountAmount(
        scholarship,
        feeStructure.grossAmount,
        componentLineItem?.adjustedAmount
      );
    } else {
      discountAmount = calculateDiscountAmount(scholarship, feeStructure.grossAmount);
    }
  } else {
    // No fee structure yet, calculate a placeholder (will be recalculated when structure is created)
    discountAmount = scholarship.type === "fixed_amount" ? scholarship.value : 0;
  }

  const studentScholarship = await prisma.studentScholarship.create({
    data: {
      studentId: input.studentId,
      scholarshipId: input.scholarshipId,
      sessionId: input.sessionId,
      discountAmount,
      approvedById: userId,
      remarks: input.remarks,
    },
    include: {
      scholarship: {
        select: {
          id: true,
          name: true,
          type: true,
          basis: true,
          value: true,
        },
      },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      session: {
        select: {
          id: true,
          name: true,
        },
      },
      approvedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // If fee structure exists, recalculate the net amount
  if (feeStructure) {
    await recalculateStudentFeeStructure(input.studentId, input.sessionId);
  }

  return studentScholarship;
}

/**
 * Remove scholarship from student
 */
export async function removeScholarship(id: string, scope: TenantScope) {
  const studentScholarship = await prisma.studentScholarship.findFirst({
    where: {
      id,
      student: {
        orgId: scope.orgId,
        branchId: scope.branchId,
      },
    },
  });

  if (!studentScholarship) {
    throw new NotFoundError("Student scholarship");
  }

  // Delete the assignment
  await prisma.studentScholarship.delete({
    where: { id },
  });

  // Recalculate fee structure
  await recalculateStudentFeeStructure(
    studentScholarship.studentId,
    studentScholarship.sessionId
  );

  return { success: true };
}

/**
 * Get scholarships assigned to a student for a session
 */
export async function getStudentScholarships(
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

  const where: Prisma.StudentScholarshipWhereInput = {
    studentId,
    isActive: true,
  };

  if (sessionId) {
    where.sessionId = sessionId;
  }

  return prisma.studentScholarship.findMany({
    where,
    include: {
      scholarship: {
        select: {
          id: true,
          name: true,
          type: true,
          basis: true,
          value: true,
          maxAmount: true,
        },
      },
      session: {
        select: {
          id: true,
          name: true,
        },
      },
      approvedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { approvedAt: "desc" },
  });
}

/**
 * Recalculate student fee structure after scholarship changes
 */
export async function recalculateStudentFeeStructure(
  studentId: string,
  sessionId: string
) {
  const feeStructure = await prisma.studentFeeStructure.findFirst({
    where: {
      studentId,
      sessionId,
    },
    include: {
      lineItems: true,
    },
  });

  if (!feeStructure) {
    return null;
  }

  // Get all active scholarships for this student/session
  const studentScholarships = await prisma.studentScholarship.findMany({
    where: {
      studentId,
      sessionId,
      isActive: true,
    },
    include: {
      scholarship: true,
    },
  });

  // Calculate total scholarship discount
  let totalScholarshipAmount = 0;
  for (const ss of studentScholarships) {
    if (ss.scholarship.type === "component_waiver" && ss.scholarship.componentId) {
      const componentLineItem = feeStructure.lineItems.find(
        (li) => li.feeComponentId === ss.scholarship.componentId
      );
      ss.discountAmount = calculateDiscountAmount(
        ss.scholarship,
        feeStructure.grossAmount,
        componentLineItem?.adjustedAmount
      );
    } else {
      ss.discountAmount = calculateDiscountAmount(ss.scholarship, feeStructure.grossAmount);
    }
    totalScholarshipAmount += ss.discountAmount;

    // Update the student scholarship with new discount
    await prisma.studentScholarship.update({
      where: { id: ss.id },
      data: { discountAmount: ss.discountAmount },
    });
  }

  // Update the fee structure
  const netAmount = Math.max(0, feeStructure.grossAmount - totalScholarshipAmount);

  return prisma.studentFeeStructure.update({
    where: { id: feeStructure.id },
    data: {
      scholarshipAmount: totalScholarshipAmount,
      netAmount,
    },
  });
}
