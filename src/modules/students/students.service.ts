import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import { NotFoundError } from "../../utils/error-handler.js";
import type {
  CreateStudentInput,
  UpdateStudentInput,
  ParentInput,
} from "./students.schema.js";

/**
 * Include clause for student queries to fetch parents
 */
const studentInclude = {
  studentParents: {
    include: {
      parent: true,
    },
  },
};

/**
 * Get all students for a branch with parents
 */
export async function getStudents(scope: TenantScope) {
  const students = await prisma.student.findMany({
    where: {
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
    include: studentInclude,
    orderBy: {
      createdAt: "desc",
    },
  });

  return students.map(formatStudentWithParents);
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

    // Create parent if doesn't exist
    if (!parent) {
      parent = await tx.parent.create({
        data: {
          firstName: parentInput.firstName,
          lastName: parentInput.lastName,
          phone: parentInput.phone,
          orgId: scope.orgId,
          branchId: scope.branchId,
        },
      });
    }

    // Link parent to student with relation
    await tx.studentParent.create({
      data: {
        studentId,
        parentId: parent.id,
        relation: parentInput.relation,
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
 * Format student with parents for response
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
  admissionYear: number;
  status: string;
  batchId: string | null;
  createdAt: Date;
  updatedAt: Date;
  studentParents: {
    relation: string;
    parent: {
      id: string;
      firstName: string;
      lastName: string;
      phone: string;
    };
  }[];
}) {
  const { studentParents, firstName, lastName, ...studentData } = student;

  return {
    ...studentData,
    firstName,
    lastName,
    fullName: formatFullName(firstName, lastName),
    parents: studentParents.map((sp) => ({
      id: sp.parent.id,
      firstName: sp.parent.firstName,
      lastName: sp.parent.lastName,
      fullName: formatFullName(sp.parent.firstName, sp.parent.lastName),
      phone: sp.parent.phone,
      relation: sp.relation,
    })),
  };
}
