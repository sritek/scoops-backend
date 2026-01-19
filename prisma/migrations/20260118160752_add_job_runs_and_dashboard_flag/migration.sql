-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('running', 'completed', 'failed', 'skipped');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "jobsDashboardEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "branchId" TEXT,
    "jobName" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "eventsEmitted" INTEGER NOT NULL DEFAULT 0,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "metadata" TEXT,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobRun_jobName_startedAt_idx" ON "JobRun"("jobName", "startedAt");

-- CreateIndex
CREATE INDEX "JobRun_status_idx" ON "JobRun"("status");

-- CreateIndex
CREATE INDEX "JobRun_orgId_idx" ON "JobRun"("orgId");

-- AddForeignKey
ALTER TABLE "JobRun" ADD CONSTRAINT "JobRun_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
