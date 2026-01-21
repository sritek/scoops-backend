import type { BloodGroup, VisionStatus, HearingStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import { NotFoundError } from "../../utils/error-handler.js";
import type {
  UpdateStudentHealthInput,
  CreateHealthCheckupInput,
} from "./health.schema.js";

/**
 * Get student health data
 */
export async function getStudentHealth(studentId: string, scope: TenantScope) {
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
      dob: true,
      gender: true,
    },
  });

  if (!student) {
    throw new NotFoundError("Student");
  }

  // Get or create health record
  let health = await prisma.studentHealth.findUnique({
    where: { studentId },
  });

  // If no health record exists, create an empty one
  if (!health) {
    health = await prisma.studentHealth.create({
      data: { studentId },
    });
  }

  return {
    student: {
      id: student.id,
      fullName: `${student.firstName} ${student.lastName}`,
      dob: student.dob,
      gender: student.gender,
    },
    health,
  };
}

/**
 * Update student health data
 */
export async function updateStudentHealth(
  studentId: string,
  input: UpdateStudentHealthInput,
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

  // Prepare data with proper type conversions
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
    vaccinationRecords?: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;
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

  // Map input to data
  if (input.bloodGroup !== undefined) {
    data.bloodGroup = input.bloodGroup as BloodGroup | null;
  }
  if (input.heightCm !== undefined) data.heightCm = input.heightCm;
  if (input.weightKg !== undefined) data.weightKg = input.weightKg;
  if (input.allergies !== undefined) data.allergies = input.allergies;
  if (input.chronicConditions !== undefined) data.chronicConditions = input.chronicConditions;
  if (input.currentMedications !== undefined) data.currentMedications = input.currentMedications;
  if (input.pastSurgeries !== undefined) data.pastSurgeries = input.pastSurgeries;
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
  if (input.usesHearingAid !== undefined) data.usesHearingAid = input.usesHearingAid;
  if (input.physicalDisability !== undefined) data.physicalDisability = input.physicalDisability;
  if (input.mobilityAid !== undefined) data.mobilityAid = input.mobilityAid;
  if (input.vaccinationRecords !== undefined) {
    data.vaccinationRecords = input.vaccinationRecords === null 
      ? Prisma.JsonNull 
      : (input.vaccinationRecords as Prisma.InputJsonValue);
  }
  if (input.hasInsurance !== undefined) data.hasInsurance = input.hasInsurance;
  if (input.insuranceProvider !== undefined) data.insuranceProvider = input.insuranceProvider;
  if (input.insurancePolicyNo !== undefined) data.insurancePolicyNo = input.insurancePolicyNo;
  if (input.insuranceExpiry !== undefined) {
    data.insuranceExpiry = input.insuranceExpiry ? new Date(input.insuranceExpiry) : null;
  }
  if (input.emergencyMedicalNotes !== undefined) {
    data.emergencyMedicalNotes = input.emergencyMedicalNotes;
  }
  if (input.familyDoctorName !== undefined) data.familyDoctorName = input.familyDoctorName;
  if (input.familyDoctorPhone !== undefined) data.familyDoctorPhone = input.familyDoctorPhone;
  if (input.preferredHospital !== undefined) data.preferredHospital = input.preferredHospital;
  if (input.lastCheckupDate !== undefined) {
    data.lastCheckupDate = input.lastCheckupDate ? new Date(input.lastCheckupDate) : null;
  }
  if (input.nextCheckupDue !== undefined) {
    data.nextCheckupDue = input.nextCheckupDue ? new Date(input.nextCheckupDue) : null;
  }
  if (input.dietaryRestrictions !== undefined) data.dietaryRestrictions = input.dietaryRestrictions;

  // Upsert health record
  const health = await prisma.studentHealth.upsert({
    where: { studentId },
    update: data,
    create: {
      studentId,
      ...data,
    },
  });

  return health;
}

/**
 * Get health checkup history for a student
 */
export async function getHealthCheckups(studentId: string, scope: TenantScope) {
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

  const checkups = await prisma.healthCheckup.findMany({
    where: { studentId },
    orderBy: { checkupDate: "desc" },
  });

  return {
    student: {
      id: student.id,
      fullName: `${student.firstName} ${student.lastName}`,
    },
    checkups,
  };
}

/**
 * Create a health checkup record
 */
export async function createHealthCheckup(
  studentId: string,
  input: CreateHealthCheckupInput,
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

  // Calculate BMI if height and weight provided
  let bmi: number | undefined;
  if (input.heightCm && input.weightKg) {
    const heightM = input.heightCm / 100;
    bmi = Math.round((input.weightKg / (heightM * heightM)) * 10) / 10;
  }

  const checkup = await prisma.healthCheckup.create({
    data: {
      studentId,
      checkupDate: new Date(input.checkupDate),
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      bmi,
      visionLeft: input.visionLeft,
      visionRight: input.visionRight,
      bloodPressure: input.bloodPressure,
      pulse: input.pulse,
      dentalStatus: input.dentalStatus,
      findings: input.findings,
      recommendations: input.recommendations,
      conductedBy: input.conductedBy,
    },
  });

  // Update last checkup date in health record
  await prisma.studentHealth.upsert({
    where: { studentId },
    update: {
      lastCheckupDate: new Date(input.checkupDate),
      heightCm: input.heightCm ?? undefined,
      weightKg: input.weightKg ?? undefined,
    },
    create: {
      studentId,
      lastCheckupDate: new Date(input.checkupDate),
      heightCm: input.heightCm,
      weightKg: input.weightKg,
    },
  });

  return checkup;
}

/**
 * Get a specific health checkup
 */
export async function getHealthCheckupById(
  studentId: string,
  checkupId: string,
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

  const checkup = await prisma.healthCheckup.findFirst({
    where: {
      id: checkupId,
      studentId,
    },
  });

  if (!checkup) {
    throw new NotFoundError("Health checkup");
  }

  return checkup;
}

/**
 * Delete a health checkup
 */
export async function deleteHealthCheckup(
  studentId: string,
  checkupId: string,
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

  const checkup = await prisma.healthCheckup.findFirst({
    where: {
      id: checkupId,
      studentId,
    },
  });

  if (!checkup) {
    throw new NotFoundError("Health checkup");
  }

  await prisma.healthCheckup.delete({
    where: { id: checkupId },
  });

  return { success: true };
}
