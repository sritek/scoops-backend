import type { Prisma, StudentStatus } from "@prisma/client";
import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import { NotFoundError } from "../../utils/error-handler.js";
import {
  type PaginationParams,
  createPaginatedResponse,
  calculateSkip,
} from "../../utils/pagination.js";
import type {
  CreateStudentInput,
  UpdateStudentInput,
  ParentInput,
  StudentFilters,
} from "./students.schema.js";

/**
 * Include clause for student queries to fetch parents and batch
 */
const studentInclude = {
  studentParents: {
    select: {
      relation: true,
      isPrimaryContact: true,
      parent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          photoUrl: true,
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
};

/**
 * Get students for a branch with pagination and filters
 */
export async function getStudents(
  scope: TenantScope,
  pagination: PaginationParams,
  filters?: StudentFilters
) {
  // Build where clause with tenant scope and filters
  const where: Prisma.StudentWhereInput = {
    orgId: scope.orgId,
    branchId: scope.branchId,
  };

  // Add status filter
  if (filters?.status) {
    where.status = filters.status as StudentStatus;
  }

  // Add batch filter
  if (filters?.batchId) {
    where.batchId = filters.batchId;
  }

  // Add gender filter
  if (filters?.gender) {
    where.gender = filters.gender;
  }

  // Add category filter
  if (filters?.category) {
    where.category = filters.category;
  }

  // Add search filter (search by first name or last name)
  if (filters?.search) {
    where.OR = [
      { firstName: { contains: filters.search, mode: "insensitive" } },
      { lastName: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  // Execute query and count in parallel
  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: studentInclude,
      orderBy: { createdAt: "desc" },
      skip: calculateSkip(pagination),
      take: pagination.limit,
    }),
    prisma.student.count({ where }),
  ]);

  return createPaginatedResponse(
    students.map(formatStudentWithParents),
    total,
    pagination
  );
}

/**
 * Get a single student by ID with parents
 */
export async function getStudentById(id: string, scope: TenantScope) {
  const student = await prisma.student.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
    include: studentInclude,
  });

  if (!student) return null;

  return formatStudentWithParents(student);
}

/**
 * Validate that batch belongs to tenant
 */
async function validateBatch(
  batchId: string | undefined,
  scope: TenantScope
): Promise<void> {
  if (!batchId) return;

  const batch = await prisma.batch.findFirst({
    where: {
      id: batchId,
      orgId: scope.orgId,
      branchId: scope.branchId,
      isActive: true,
    },
  });

  if (!batch) {
    throw new NotFoundError("Batch not found or not in the same branch");
  }
}

/**
 * Create a new student with parents
 */
export async function createStudent(
  input: CreateStudentInput,
  scope: TenantScope
) {
  // Validate batch belongs to tenant if provided
  await validateBatch(input.batchId, scope);

  const student = await prisma.$transaction(async (tx) => {
    // Create the student
    const newStudent = await tx.student.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        gender: input.gender,
        dob: input.dob ? new Date(input.dob) : null,
        category: input.category,
        isCwsn: input.isCwsn ?? false,
        photoUrl: input.photoUrl || null,
        admissionYear: input.admissionYear,
        batchId: input.batchId,
        status: "active",
        orgId: scope.orgId,
        branchId: scope.branchId,
      },
    });

    // Create and link parents if provided
    if (input.parents && input.parents.length > 0) {
      await createAndLinkParents(tx, newStudent.id, input.parents, scope);
    }

    // Fetch the student with parents
    return tx.student.findUnique({
      where: { id: newStudent.id },
      include: studentInclude,
    });
  });

  return student ? formatStudentWithParents(student) : null;
}

/**
 * Update an existing student with parents
 */
export async function updateStudent(
  id: string,
  input: UpdateStudentInput,
  scope: TenantScope
) {
  // First verify student belongs to tenant
  const existing = await prisma.student.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!existing) {
    return null;
  }

  // Validate batch belongs to tenant if provided (and not null)
  if (input.batchId !== undefined && input.batchId !== null) {
    await validateBatch(input.batchId, scope);
  }

  const student = await prisma.$transaction(async (tx) => {
    // Update the student
    await tx.student.update({
      where: { id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        gender: input.gender,
        dob: input.dob ? new Date(input.dob) : undefined,
        category: input.category,
        isCwsn: input.isCwsn,
        photoUrl: input.photoUrl,
        admissionYear: input.admissionYear,
        batchId: input.batchId,
        status: input.status,
      },
    });

    // Update parents if provided (replace all)
    if (input.parents !== undefined) {
      // Remove existing parent links
      await tx.studentParent.deleteMany({
        where: { studentId: id },
      });

      // Create and link new parents
      if (input.parents.length > 0) {
        await createAndLinkParents(tx, id, input.parents, scope);
      }
    }

    // Fetch the student with parents
    return tx.student.findUnique({
      where: { id },
      include: studentInclude,
    });
  });

  return student ? formatStudentWithParents(student) : null;
}

/**
 * Soft delete (deactivate) a student
 */
export async function deactivateStudent(id: string, scope: TenantScope) {
  // First verify student belongs to tenant
  const existing = await prisma.student.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!existing) {
    return null;
  }

  const student = await prisma.student.update({
    where: { id },
    data: {
      status: "inactive",
    },
    include: studentInclude,
  });

  return formatStudentWithParents(student);
}

/**
 * Create parents and link them to a student
 */
async function createAndLinkParents(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  studentId: string,
  parents: ParentInput[],
  scope: TenantScope
) {
  for (const parentInput of parents) {
    // Check if parent with same phone already exists in this branch
    let parent = await tx.parent.findFirst({
      where: {
        phone: parentInput.phone,
        orgId: scope.orgId,
        branchId: scope.branchId,
      },
    });

    // Create parent if doesn't exist, or update photo if provided
    if (!parent) {
      parent = await tx.parent.create({
        data: {
          firstName: parentInput.firstName,
          lastName: parentInput.lastName,
          phone: parentInput.phone,
          photoUrl: parentInput.photoUrl || null,
          orgId: scope.orgId,
          branchId: scope.branchId,
        },
      });
    } else if (parentInput.photoUrl) {
      // Update parent photo if provided
      parent = await tx.parent.update({
        where: { id: parent.id },
        data: { photoUrl: parentInput.photoUrl },
      });
    }

    // Link parent to student with relation and primary contact status
    await tx.studentParent.create({
      data: {
        studentId,
        parentId: parent.id,
        relation: parentInput.relation,
        isPrimaryContact: parentInput.isPrimaryContact ?? false,
      },
    });
  }
}

/**
 * Helper to format full name
 */
function formatFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/**
 * Format student with parents and batch for response
 */
function formatStudentWithParents(student: {
  id: string;
  orgId: string;
  branchId: string;
  firstName: string;
  lastName: string;
  gender: string | null;
  dob: Date | null;
  category: string | null;
  isCwsn: boolean | null;
  photoUrl: string | null;
  admissionYear: number;
  status: string;
  batchId: string | null;
  createdAt: Date;
  updatedAt: Date;
  studentParents: {
    relation: string;
    isPrimaryContact: boolean;
    parent: {
      id: string;
      firstName: string;
      lastName: string;
      phone: string;
      photoUrl: string | null;
    };
  }[];
  batch: {
    id: string;
    name: string;
  } | null;
}) {
  const { studentParents, firstName, lastName, batch, ...studentData } = student;

  return {
    ...studentData,
    firstName,
    lastName,
    fullName: formatFullName(firstName, lastName),
    batchName: batch?.name ?? null,
    parents: studentParents.map((sp) => ({
      id: sp.parent.id,
      firstName: sp.parent.firstName,
      lastName: sp.parent.lastName,
      fullName: formatFullName(sp.parent.firstName, sp.parent.lastName),
      phone: sp.parent.phone,
      photoUrl: sp.parent.photoUrl,
      relation: sp.relation,
      isPrimaryContact: sp.isPrimaryContact,
    })),
  };
}
