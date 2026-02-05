import {
  type StudentStatus,
  type BloodGroup,
  type VisionStatus,
  type HearingStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import { NotFoundError, BadRequestError } from "../../utils/error-handler.js";
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
  CustomDiscountInput,
} from "./students.schema.js";
import {
  calculateCustomDiscountAmount,
  calculateNetAmount,
} from "../fees/discount-calculation.js";

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
  filters?: StudentFilters,
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

  // Add search filter (token-based: each word must match firstName or lastName)
  if (filters?.search?.trim()) {
    const tokens = filters.search.trim().split(/\s+/).filter(Boolean);
    if (tokens.length > 0) {
      where.AND = tokens.map((token) => ({
        OR: [
          { firstName: { contains: token, mode: "insensitive" } },
          { lastName: { contains: token, mode: "insensitive" } },
        ],
      }));
    }
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
    pagination,
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
  scope: TenantScope,
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
 * Validate that session belongs to tenant
 */
async function validateSession(
  sessionId: string,
  scope: TenantScope,
): Promise<void> {
  const session = await prisma.academicSession.findFirst({
    where: {
      id: sessionId,
      orgId: scope.orgId,
    },
  });

  if (!session) {
    throw new NotFoundError("Academic session not found");
  }
}

/**
 * Map health input to Prisma format
 */
function mapHealthInput(input: NonNullable<CreateStudentInput["health"]>) {
  const data: {
    bloodGroup?: BloodGroup | null;
    heightCm?: number | null;
    weightKg?: number | null;
    allergies?: string | null;
    chronicConditions?: string | null;
    currentMedications?: string | null;
    pastSurgeries?: string | null;
    visionLeft?: VisionStatus | null;
    visionRight?: VisionStatus | null;
    usesGlasses?: boolean;
    hearingStatus?: HearingStatus | null;
    usesHearingAid?: boolean;
    physicalDisability?: string | null;
    mobilityAid?: string | null;
    vaccinationRecords?:
      | Prisma.NullableJsonNullValueInput
      | Prisma.InputJsonValue;
    hasInsurance?: boolean;
    insuranceProvider?: string | null;
    insurancePolicyNo?: string | null;
    insuranceExpiry?: Date | null;
    emergencyMedicalNotes?: string | null;
    familyDoctorName?: string | null;
    familyDoctorPhone?: string | null;
    preferredHospital?: string | null;
    lastCheckupDate?: Date | null;
    nextCheckupDue?: Date | null;
    dietaryRestrictions?: string | null;
  } = {};

  if (input.bloodGroup !== undefined) {
    data.bloodGroup = input.bloodGroup as BloodGroup | null;
  }
  if (input.heightCm !== undefined) data.heightCm = input.heightCm;
  if (input.weightKg !== undefined) data.weightKg = input.weightKg;
  if (input.allergies !== undefined) data.allergies = input.allergies;
  if (input.chronicConditions !== undefined)
    data.chronicConditions = input.chronicConditions;
  if (input.currentMedications !== undefined)
    data.currentMedications = input.currentMedications;
  if (input.pastSurgeries !== undefined)
    data.pastSurgeries = input.pastSurgeries;
  if (input.visionLeft !== undefined) {
    data.visionLeft = input.visionLeft as VisionStatus | null;
  }
  if (input.visionRight !== undefined) {
    data.visionRight = input.visionRight as VisionStatus | null;
  }
  if (input.usesGlasses !== undefined) data.usesGlasses = input.usesGlasses;
  if (input.hearingStatus !== undefined) {
    data.hearingStatus = input.hearingStatus as HearingStatus | null;
  }
  if (input.usesHearingAid !== undefined)
    data.usesHearingAid = input.usesHearingAid;
  if (input.physicalDisability !== undefined)
    data.physicalDisability = input.physicalDisability;
  if (input.mobilityAid !== undefined) data.mobilityAid = input.mobilityAid;
  if (input.vaccinationRecords !== undefined) {
    data.vaccinationRecords =
      input.vaccinationRecords === null
        ? Prisma.JsonNull
        : (input.vaccinationRecords as Prisma.InputJsonValue);
  }
  if (input.hasInsurance !== undefined) data.hasInsurance = input.hasInsurance;
  if (input.insuranceProvider !== undefined)
    data.insuranceProvider = input.insuranceProvider;
  if (input.insurancePolicyNo !== undefined)
    data.insurancePolicyNo = input.insurancePolicyNo;
  if (input.insuranceExpiry !== undefined) {
    data.insuranceExpiry = input.insuranceExpiry
      ? new Date(input.insuranceExpiry)
      : null;
  }
  if (input.emergencyMedicalNotes !== undefined) {
    data.emergencyMedicalNotes = input.emergencyMedicalNotes;
  }
  if (input.familyDoctorName !== undefined)
    data.familyDoctorName = input.familyDoctorName;
  if (input.familyDoctorPhone !== undefined)
    data.familyDoctorPhone = input.familyDoctorPhone;
  if (input.preferredHospital !== undefined)
    data.preferredHospital = input.preferredHospital;
  if (input.lastCheckupDate !== undefined) {
    data.lastCheckupDate = input.lastCheckupDate
      ? new Date(input.lastCheckupDate)
      : null;
  }
  if (input.nextCheckupDue !== undefined) {
    data.nextCheckupDue = input.nextCheckupDue
      ? new Date(input.nextCheckupDue)
      : null;
  }
  if (input.dietaryRestrictions !== undefined)
    data.dietaryRestrictions = input.dietaryRestrictions;

  return data;
}

/**
 * Apply batch fee structure to student within transaction
 * Optionally applies a custom discount to the fee structure
 */
async function applyBatchFeeStructureInTransaction(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  batchFeeStructureId: string,
  studentId: string,
  sessionId: string,
  scope: TenantScope,
  customDiscount?: CustomDiscountInput,
): Promise<void> {
  // Get batch fee structure
  const structure = await tx.batchFeeStructure.findFirst({
    where: {
      id: batchFeeStructureId,
      orgId: scope.orgId,
      branchId: scope.branchId,
      isActive: true,
    },
    include: {
      lineItems: true,
    },
  });

  if (!structure) {
    throw new NotFoundError("Batch fee structure not found");
  }

  // Check if student already has fee structure for this session
  const existing = await tx.studentFeeStructure.findFirst({
    where: {
      studentId,
      sessionId,
    },
  });

  if (existing) {
    // Overwrite existing structure
    await tx.studentFeeStructure.deleteMany({
      where: {
        studentId,
        sessionId,
      },
    });
  }

  // Calculate custom discount amount if provided
  let customDiscountType: string | null = null;
  let customDiscountValue: number | null = null;
  let customDiscountAmount: number | null = null;
  let customDiscountRemarks: string | null = null;

  if (customDiscount) {
    customDiscountType = customDiscount.type;
    customDiscountValue = customDiscount.value;
    customDiscountAmount = calculateCustomDiscountAmount(
      customDiscount.type,
      customDiscount.value,
      structure.totalAmount,
    );
    customDiscountRemarks = customDiscount.remarks ?? null;
  }

  // Calculate net amount including custom discount
  const netAmount = calculateNetAmount(
    structure.totalAmount,
    0, // scholarshipAmount starts at 0, will be updated when scholarships are assigned
    customDiscountAmount ?? 0,
  );

  // Create student fee structure with custom discount fields
  await tx.studentFeeStructure.create({
    data: {
      studentId,
      sessionId: structure.sessionId,
      source: "batch_default",
      batchFeeStructureId: structure.id,
      grossAmount: structure.totalAmount,
      scholarshipAmount: 0,
      netAmount,
      customDiscountType,
      customDiscountValue,
      customDiscountAmount,
      customDiscountRemarks,
      lineItems: {
        create: structure.lineItems.map((li) => ({
          feeComponentId: li.feeComponentId,
          originalAmount: li.amount,
          adjustedAmount: li.amount,
        })),
      },
    },
  });
}

/**
 * Calculate scholarship discount amount
 */
function calculateDiscountAmount(
  scholarship: {
    type: string;
    value: number;
    maxAmount: number | null;
  },
  grossAmount: number,
  componentAmount?: number,
): number {
  let discount = 0;

  switch (scholarship.type) {
    case "percentage":
      discount = Math.round((grossAmount * scholarship.value) / 100);
      if (scholarship.maxAmount && discount > scholarship.maxAmount) {
        discount = scholarship.maxAmount;
      }
      break;
    case "fixed_amount":
      discount = scholarship.value;
      if (discount > grossAmount) {
        discount = grossAmount;
      }
      break;
    case "component_waiver":
      discount = componentAmount ?? 0;
      break;
  }

  return discount;
}

/**
 * Assign scholarship to student within transaction
 */
async function assignScholarshipInTransaction(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  studentId: string,
  scholarshipId: string,
  sessionId: string,
  userId: string,
  scope: TenantScope,
): Promise<void> {
  // Verify scholarship belongs to org
  const scholarship = await tx.scholarship.findFirst({
    where: {
      id: scholarshipId,
      orgId: scope.orgId,
      isActive: true,
    },
  });

  if (!scholarship) {
    throw new NotFoundError("Scholarship");
  }

  // Check if already assigned for this session
  const existing = await tx.studentScholarship.findFirst({
    where: {
      studentId,
      scholarshipId,
      sessionId,
    },
  });

  if (existing) {
    throw new BadRequestError(
      "This scholarship is already assigned to the student for this session",
    );
  }

  // Get student's fee structure to calculate discount
  const feeStructure = await tx.studentFeeStructure.findFirst({
    where: {
      studentId,
      sessionId,
    },
    include: {
      lineItems: true,
    },
  });

  let discountAmount = 0;

  if (feeStructure) {
    // Calculate discount based on scholarship type
    if (scholarship.type === "component_waiver" && scholarship.componentId) {
      const componentLineItem = feeStructure.lineItems.find(
        (li) => li.feeComponentId === scholarship.componentId,
      );
      discountAmount = calculateDiscountAmount(
        scholarship,
        feeStructure.grossAmount,
        componentLineItem?.adjustedAmount,
      );
    } else {
      discountAmount = calculateDiscountAmount(
        scholarship,
        feeStructure.grossAmount,
      );
    }
  } else {
    // No fee structure yet, calculate a placeholder
    discountAmount =
      scholarship.type === "fixed_amount" ? scholarship.value : 0;
  }

  // Create student scholarship
  await tx.studentScholarship.create({
    data: {
      studentId,
      scholarshipId,
      sessionId,
      discountAmount,
      approvedById: userId,
    },
  });

  // If fee structure exists, update net amount
  if (feeStructure) {
    // Get all scholarships for this student/session
    const allScholarships = await tx.studentScholarship.findMany({
      where: {
        studentId,
        sessionId,
        isActive: true,
      },
      include: {
        scholarship: true,
      },
    });

    // Calculate total scholarship amount
    let totalScholarshipAmount = 0;
    for (const ss of allScholarships) {
      if (
        ss.scholarship.type === "component_waiver" &&
        ss.scholarship.componentId
      ) {
        const componentLineItem = feeStructure.lineItems.find(
          (li) => li.feeComponentId === ss.scholarship.componentId,
        );
        const discount = calculateDiscountAmount(
          ss.scholarship,
          feeStructure.grossAmount,
          componentLineItem?.adjustedAmount,
        );
        totalScholarshipAmount += discount;
        // Update discount amount
        await tx.studentScholarship.update({
          where: { id: ss.id },
          data: { discountAmount: discount },
        });
      } else {
        const discount = calculateDiscountAmount(
          ss.scholarship,
          feeStructure.grossAmount,
        );
        totalScholarshipAmount += discount;
        // Update discount amount
        await tx.studentScholarship.update({
          where: { id: ss.id },
          data: { discountAmount: discount },
        });
      }
    }

    const netAmount = calculateNetAmount(
      feeStructure.grossAmount,
      totalScholarshipAmount,
      feeStructure.customDiscountAmount ?? 0,
    );

    // Update fee structure
    await tx.studentFeeStructure.update({
      where: { id: feeStructure.id },
      data: {
        scholarshipAmount: totalScholarshipAmount,
        netAmount,
      },
    });
  }
}

/**
 * Create a new student with parents, health, fees, and scholarships
 */
export async function createStudent(
  input: CreateStudentInput,
  scope: TenantScope,
  userId: string,
) {
  // Validate batch belongs to tenant if provided
  await validateBatch(input.batchId, scope);

  // Validate session if fees/scholarships provided
  if (
    input.batchFeeStructureId ||
    (input.scholarshipIds && input.scholarshipIds.length > 0)
  ) {
    if (!input.sessionId) {
      throw new BadRequestError(
        "sessionId is required when applying fees or scholarships",
      );
    }
    await validateSession(input.sessionId, scope);
  }

  // Validate custom discount requires fee structure (Requirement 4.4)
  if (input.customDiscount && !input.batchFeeStructureId) {
    throw new BadRequestError(
      "Custom discount requires a fee structure to be applied",
    );
  }

  const student = await prisma.$transaction(
    async (tx) => {
      // 1. Create the student
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

      // 2. Create and link parents if provided
      if (input.parents && input.parents.length > 0) {
        await createAndLinkParents(tx, newStudent.id, input.parents, scope);
      }

      // 3. Create health data if provided
      if (input.health) {
        const healthData = mapHealthInput(input.health);
        // Only create if there's actual data (not all null/undefined)
        const hasHealthData = Object.values(healthData).some(
          (v) => v !== undefined && v !== null && v !== "",
        );
        if (hasHealthData) {
          await tx.studentHealth.create({
            data: {
              studentId: newStudent.id,
              ...healthData,
            },
          });
        }
      }

      // 4. Apply batch fee structure if provided (with optional custom discount)
      if (input.batchFeeStructureId && input.sessionId) {
        await applyBatchFeeStructureInTransaction(
          tx,
          input.batchFeeStructureId,
          newStudent.id,
          input.sessionId,
          scope,
          input.customDiscount,
        );
      }

      // 5. Assign scholarships if provided
      if (
        input.scholarshipIds &&
        input.scholarshipIds.length > 0 &&
        input.sessionId
      ) {
        for (const scholarshipId of input.scholarshipIds) {
          await assignScholarshipInTransaction(
            tx,
            newStudent.id,
            scholarshipId,
            input.sessionId,
            userId,
            scope,
          );
        }
      }

      // Fetch the student with parents
      return tx.student.findUnique({
        where: { id: newStudent.id },
        include: studentInclude,
      });
    },
    {
      maxWait: 10000, // 10 seconds max wait to acquire connection
      timeout: 30000, // 30 seconds transaction timeout
    },
  );

  return student ? formatStudentWithParents(student) : null;
}

/**
 * Update an existing student with parents
 */
export async function updateStudent(
  id: string,
  input: UpdateStudentInput,
  scope: TenantScope,
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

  await prisma.$transaction(async (tx) => {
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

    // Update health data if provided
    if (input.health !== undefined) {
      const healthData = mapHealthInput(input.health);
      // Check if there's actual data (not all null/undefined)
      const hasHealthData = Object.values(healthData).some(
        (v) => v !== undefined && v !== null && v !== "",
      );

      if (hasHealthData) {
        // Upsert health record
        await tx.studentHealth.upsert({
          where: { studentId: id },
          update: healthData,
          create: {
            studentId: id,
            ...healthData,
          },
        });
      } else {
        // If all values are null/undefined, delete health record if it exists
        await tx.studentHealth.deleteMany({
          where: { studentId: id },
        });
      }
    }

    return null;
  });

  const updatedStudent = await prisma.student.findUnique({
    where: { id },
    include: studentInclude,
  });

  return updatedStudent ? formatStudentWithParents(updatedStudent) : null;
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
  scope: TenantScope,
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
    } else {
      // Update parent data (name and/or photo)
      parent = await tx.parent.update({
        where: { id: parent.id },
        data: {
          firstName: parentInput.firstName,
          lastName: parentInput.lastName,
          photoUrl:
            parentInput.photoUrl !== undefined
              ? parentInput.photoUrl
              : parent.photoUrl,
        },
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
  const { studentParents, firstName, lastName, batch, ...studentData } =
    student;

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
