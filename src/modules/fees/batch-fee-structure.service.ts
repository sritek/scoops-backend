import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import { NotFoundError, BadRequestError } from "../../utils/error-handler.js";
import type {
  CreateBatchFeeStructureInput,
  UpdateBatchFeeStructureInput,
  FeeLineItem,
} from "./batch-fee-structure.schema.js";

/**
 * Get batch fee structure by batch ID and session
 */
export async function getBatchFeeStructure(
  batchId: string,
  sessionId: string,
  scope: TenantScope
) {
  const structure = await prisma.batchFeeStructure.findFirst({
    where: {
      batchId,
      sessionId,
      orgId: scope.orgId,
      branchId: scope.branchId,
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
      batch: {
        select: {
          id: true,
          name: true,
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
 * Get batch fee structure by ID
 */
export async function getBatchFeeStructureById(id: string, scope: TenantScope) {
  const structure = await prisma.batchFeeStructure.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
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
      batch: {
        select: {
          id: true,
          name: true,
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

  if (!structure) {
    throw new NotFoundError("Batch fee structure");
  }

  return structure;
}

/**
 * Create or update batch fee structure
 */
export async function createOrUpdateBatchFeeStructure(
  input: CreateBatchFeeStructureInput,
  scope: TenantScope
) {
  // Verify batch belongs to tenant
  const batch = await prisma.batch.findFirst({
    where: {
      id: input.batchId,
      branchId: scope.branchId,
    },
  });

  if (!batch) {
    throw new NotFoundError("Batch");
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
    throw new BadRequestError("One or more fee components are invalid or inactive");
  }

  // Calculate total amount
  const totalAmount = input.lineItems.reduce((sum, li) => sum + li.amount, 0);

  // Check if structure already exists
  const existing = await prisma.batchFeeStructure.findFirst({
    where: {
      batchId: input.batchId,
      sessionId: input.sessionId,
    },
  });

  if (existing) {
    // Update existing structure
    // First, delete all existing line items
    await prisma.batchFeeLineItem.deleteMany({
      where: { batchFeeStructureId: existing.id },
    });

    // Update structure and create new line items
    const structure = await prisma.batchFeeStructure.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        totalAmount,
        lineItems: {
          create: input.lineItems.map((li) => ({
            feeComponentId: li.feeComponentId,
            amount: li.amount,
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
        batch: {
          select: {
            id: true,
            name: true,
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

  // Create new structure
  const structure = await prisma.batchFeeStructure.create({
    data: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      batchId: input.batchId,
      sessionId: input.sessionId,
      name: input.name,
      totalAmount,
      lineItems: {
        create: input.lineItems.map((li) => ({
          feeComponentId: li.feeComponentId,
          amount: li.amount,
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
      batch: {
        select: {
          id: true,
          name: true,
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
 * Update batch fee structure
 */
export async function updateBatchFeeStructure(
  id: string,
  input: UpdateBatchFeeStructureInput,
  scope: TenantScope
) {
  const existing = await prisma.batchFeeStructure.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!existing) {
    throw new NotFoundError("Batch fee structure");
  }

  let totalAmount = existing.totalAmount;

  // If updating line items, verify components and recalculate total
  if (input.lineItems) {
    const componentIds = input.lineItems.map((li) => li.feeComponentId);
    const components = await prisma.feeComponent.findMany({
      where: {
        id: { in: componentIds },
        orgId: scope.orgId,
        isActive: true,
      },
    });

    if (components.length !== componentIds.length) {
      throw new BadRequestError("One or more fee components are invalid or inactive");
    }

    totalAmount = input.lineItems.reduce((sum, li) => sum + li.amount, 0);

    // Delete existing line items
    await prisma.batchFeeLineItem.deleteMany({
      where: { batchFeeStructureId: id },
    });
  }

  const structure = await prisma.batchFeeStructure.update({
    where: { id },
    data: {
      name: input.name,
      totalAmount: input.lineItems ? totalAmount : undefined,
      isActive: input.isActive,
      ...(input.lineItems && {
        lineItems: {
          create: input.lineItems.map((li) => ({
            feeComponentId: li.feeComponentId,
            amount: li.amount,
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
      batch: {
        select: {
          id: true,
          name: true,
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
 * Apply batch fee structure to all students in the batch
 */
export async function applyToStudents(
  id: string,
  overwriteExisting: boolean,
  scope: TenantScope
) {
  const structure = await prisma.batchFeeStructure.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
      isActive: true,
    },
    include: {
      lineItems: true,
      batch: {
        include: {
          students: {
            where: {
              status: "active",
            },
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  if (!structure) {
    throw new NotFoundError("Batch fee structure");
  }

  const studentIds = structure.batch.students.map((s) => s.id);

  if (studentIds.length === 0) {
    return {
      applied: 0,
      skipped: 0,
      message: "No active students in batch",
    };
  }

  // Check existing student fee structures
  const existingStructures = await prisma.studentFeeStructure.findMany({
    where: {
      studentId: { in: studentIds },
      sessionId: structure.sessionId,
    },
    select: {
      studentId: true,
    },
  });

  const existingStudentIds = new Set(existingStructures.map((s) => s.studentId));

  let applied = 0;
  let skipped = 0;

  for (const studentId of studentIds) {
    const hasExisting = existingStudentIds.has(studentId);

    if (hasExisting && !overwriteExisting) {
      skipped++;
      continue;
    }

    // If overwriting, delete existing structure
    if (hasExisting && overwriteExisting) {
      await prisma.studentFeeStructure.deleteMany({
        where: {
          studentId,
          sessionId: structure.sessionId,
        },
      });
    }

    // Create student fee structure
    await prisma.studentFeeStructure.create({
      data: {
        studentId,
        sessionId: structure.sessionId,
        source: "batch_default",
        batchFeeStructureId: structure.id,
        grossAmount: structure.totalAmount,
        scholarshipAmount: 0,
        netAmount: structure.totalAmount,
        lineItems: {
          create: structure.lineItems.map((li) => ({
            feeComponentId: li.feeComponentId,
            originalAmount: li.amount,
            adjustedAmount: li.amount,
          })),
        },
      },
    });

    applied++;
  }

  return {
    applied,
    skipped,
    message: `Applied to ${applied} students, skipped ${skipped} (already have fee structure)`,
  };
}

/**
 * Get all batch fee structures for a branch
 */
export async function getAllBatchFeeStructures(
  sessionId: string | undefined,
  scope: TenantScope
) {
  const where: {
    orgId: string;
    branchId: string;
    isActive: boolean;
    sessionId?: string;
  } = {
    orgId: scope.orgId,
    branchId: scope.branchId,
    isActive: true,
  };

  if (sessionId) {
    where.sessionId = sessionId;
  }

  return prisma.batchFeeStructure.findMany({
    where,
    include: {
      batch: {
        select: {
          id: true,
          name: true,
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
          lineItems: true,
        },
      },
    },
    orderBy: [
      { session: { name: "desc" } },
      { batch: { name: "asc" } },
    ],
  });
}
