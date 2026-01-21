-- CreateEnum
CREATE TYPE "FeeComponentType" AS ENUM ('tuition', 'admission', 'transport', 'lab', 'library', 'sports', 'exam', 'uniform', 'misc');

-- CreateEnum
CREATE TYPE "ScholarshipType" AS ENUM ('percentage', 'fixed_amount', 'component_waiver');

-- CreateEnum
CREATE TYPE "ScholarshipBasis" AS ENUM ('merit', 'need_based', 'sports', 'sibling', 'staff_ward', 'government', 'custom');

-- CreateEnum
CREATE TYPE "FeeStructureSource" AS ENUM ('batch_default', 'custom');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('upcoming', 'due', 'overdue', 'partial', 'paid');

-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A_positive', 'A_negative', 'B_positive', 'B_negative', 'AB_positive', 'AB_negative', 'O_positive', 'O_negative', 'unknown');

-- CreateEnum
CREATE TYPE "VisionStatus" AS ENUM ('normal', 'corrected_with_glasses', 'corrected_with_lenses', 'impaired');

-- CreateEnum
CREATE TYPE "HearingStatus" AS ENUM ('normal', 'mild_impairment', 'moderate_impairment', 'severe_impairment');

-- CreateTable
CREATE TABLE "FeeComponent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FeeComponentType" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchFeeStructure" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchFeeStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchFeeLineItem" (
    "id" TEXT NOT NULL,
    "batchFeeStructureId" TEXT NOT NULL,
    "feeComponentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "BatchFeeLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scholarship" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ScholarshipType" NOT NULL,
    "basis" "ScholarshipBasis" NOT NULL,
    "value" INTEGER NOT NULL,
    "componentId" TEXT,
    "maxAmount" INTEGER,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scholarship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentScholarship" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "scholarshipId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "discountAmount" INTEGER NOT NULL,
    "approvedById" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentScholarship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentFeeStructure" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "source" "FeeStructureSource" NOT NULL,
    "batchFeeStructureId" TEXT,
    "grossAmount" INTEGER NOT NULL,
    "scholarshipAmount" INTEGER NOT NULL DEFAULT 0,
    "netAmount" INTEGER NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentFeeStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentFeeLineItem" (
    "id" TEXT NOT NULL,
    "studentFeeStructureId" TEXT NOT NULL,
    "feeComponentId" TEXT NOT NULL,
    "originalAmount" INTEGER NOT NULL,
    "adjustedAmount" INTEGER NOT NULL,
    "waived" BOOLEAN NOT NULL DEFAULT false,
    "waiverReason" TEXT,

    CONSTRAINT "StudentFeeLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EMIPlanTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "installmentCount" INTEGER NOT NULL,
    "splitConfig" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EMIPlanTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeInstallment" (
    "id" TEXT NOT NULL,
    "studentFeeStructureId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'upcoming',
    "reminderSentAt" TIMESTAMP(3),
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallmentPayment" (
    "id" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL,
    "transactionRef" TEXT,
    "receivedById" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" TEXT,

    CONSTRAINT "InstallmentPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeReminder" (
    "id" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL,
    "providerMsgId" TEXT,

    CONSTRAINT "FeeReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentHealth" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "bloodGroup" "BloodGroup",
    "heightCm" DOUBLE PRECISION,
    "weightKg" DOUBLE PRECISION,
    "allergies" TEXT,
    "chronicConditions" TEXT,
    "currentMedications" TEXT,
    "pastSurgeries" TEXT,
    "visionLeft" "VisionStatus",
    "visionRight" "VisionStatus",
    "usesGlasses" BOOLEAN NOT NULL DEFAULT false,
    "hearingStatus" "HearingStatus",
    "usesHearingAid" BOOLEAN NOT NULL DEFAULT false,
    "physicalDisability" TEXT,
    "mobilityAid" TEXT,
    "vaccinationRecords" JSONB,
    "hasInsurance" BOOLEAN NOT NULL DEFAULT false,
    "insuranceProvider" TEXT,
    "insurancePolicyNo" TEXT,
    "insuranceExpiry" TIMESTAMP(3),
    "emergencyMedicalNotes" TEXT,
    "familyDoctorName" TEXT,
    "familyDoctorPhone" TEXT,
    "preferredHospital" TEXT,
    "lastCheckupDate" TIMESTAMP(3),
    "nextCheckupDue" TIMESTAMP(3),
    "dietaryRestrictions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentHealth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthCheckup" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "checkupDate" TIMESTAMP(3) NOT NULL,
    "heightCm" DOUBLE PRECISION,
    "weightKg" DOUBLE PRECISION,
    "bmi" DOUBLE PRECISION,
    "visionLeft" TEXT,
    "visionRight" TEXT,
    "bloodPressure" TEXT,
    "pulse" INTEGER,
    "dentalStatus" TEXT,
    "findings" TEXT,
    "recommendations" TEXT,
    "conductedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthCheckup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeeComponent_orgId_type_name_key" ON "FeeComponent"("orgId", "type", "name");

-- CreateIndex
CREATE INDEX "BatchFeeStructure_orgId_branchId_idx" ON "BatchFeeStructure"("orgId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "BatchFeeStructure_batchId_sessionId_key" ON "BatchFeeStructure"("batchId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "BatchFeeLineItem_batchFeeStructureId_feeComponentId_key" ON "BatchFeeLineItem"("batchFeeStructureId", "feeComponentId");

-- CreateIndex
CREATE UNIQUE INDEX "Scholarship_orgId_name_key" ON "Scholarship"("orgId", "name");

-- CreateIndex
CREATE INDEX "StudentScholarship_studentId_idx" ON "StudentScholarship"("studentId");

-- CreateIndex
CREATE INDEX "StudentScholarship_sessionId_idx" ON "StudentScholarship"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentScholarship_studentId_scholarshipId_sessionId_key" ON "StudentScholarship"("studentId", "scholarshipId", "sessionId");

-- CreateIndex
CREATE INDEX "StudentFeeStructure_sessionId_idx" ON "StudentFeeStructure"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentFeeStructure_studentId_sessionId_key" ON "StudentFeeStructure"("studentId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentFeeLineItem_studentFeeStructureId_feeComponentId_key" ON "StudentFeeLineItem"("studentFeeStructureId", "feeComponentId");

-- CreateIndex
CREATE UNIQUE INDEX "EMIPlanTemplate_orgId_name_key" ON "EMIPlanTemplate"("orgId", "name");

-- CreateIndex
CREATE INDEX "FeeInstallment_dueDate_status_idx" ON "FeeInstallment"("dueDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FeeInstallment_studentFeeStructureId_installmentNumber_key" ON "FeeInstallment"("studentFeeStructureId", "installmentNumber");

-- CreateIndex
CREATE INDEX "InstallmentPayment_installmentId_idx" ON "InstallmentPayment"("installmentId");

-- CreateIndex
CREATE INDEX "FeeReminder_installmentId_sentAt_idx" ON "FeeReminder"("installmentId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentHealth_studentId_key" ON "StudentHealth"("studentId");

-- CreateIndex
CREATE INDEX "HealthCheckup_studentId_checkupDate_idx" ON "HealthCheckup"("studentId", "checkupDate");

-- AddForeignKey
ALTER TABLE "FeeComponent" ADD CONSTRAINT "FeeComponent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchFeeStructure" ADD CONSTRAINT "BatchFeeStructure_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchFeeStructure" ADD CONSTRAINT "BatchFeeStructure_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchFeeLineItem" ADD CONSTRAINT "BatchFeeLineItem_batchFeeStructureId_fkey" FOREIGN KEY ("batchFeeStructureId") REFERENCES "BatchFeeStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchFeeLineItem" ADD CONSTRAINT "BatchFeeLineItem_feeComponentId_fkey" FOREIGN KEY ("feeComponentId") REFERENCES "FeeComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scholarship" ADD CONSTRAINT "Scholarship_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scholarship" ADD CONSTRAINT "Scholarship_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "FeeComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentScholarship" ADD CONSTRAINT "StudentScholarship_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentScholarship" ADD CONSTRAINT "StudentScholarship_scholarshipId_fkey" FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentScholarship" ADD CONSTRAINT "StudentScholarship_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentScholarship" ADD CONSTRAINT "StudentScholarship_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeStructure" ADD CONSTRAINT "StudentFeeStructure_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeStructure" ADD CONSTRAINT "StudentFeeStructure_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeStructure" ADD CONSTRAINT "StudentFeeStructure_batchFeeStructureId_fkey" FOREIGN KEY ("batchFeeStructureId") REFERENCES "BatchFeeStructure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeLineItem" ADD CONSTRAINT "StudentFeeLineItem_studentFeeStructureId_fkey" FOREIGN KEY ("studentFeeStructureId") REFERENCES "StudentFeeStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeLineItem" ADD CONSTRAINT "StudentFeeLineItem_feeComponentId_fkey" FOREIGN KEY ("feeComponentId") REFERENCES "FeeComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EMIPlanTemplate" ADD CONSTRAINT "EMIPlanTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeInstallment" ADD CONSTRAINT "FeeInstallment_studentFeeStructureId_fkey" FOREIGN KEY ("studentFeeStructureId") REFERENCES "StudentFeeStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentPayment" ADD CONSTRAINT "InstallmentPayment_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "FeeInstallment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentPayment" ADD CONSTRAINT "InstallmentPayment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeReminder" ADD CONSTRAINT "FeeReminder_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "FeeInstallment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeReminder" ADD CONSTRAINT "FeeReminder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentHealth" ADD CONSTRAINT "StudentHealth_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthCheckup" ADD CONSTRAINT "HealthCheckup_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
