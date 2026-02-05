-- AlterTable
ALTER TABLE "FeeInstallment" ADD COLUMN     "cancelledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StudentFeeStructure" ADD COLUMN     "refundAmountPaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "refundClearedAt" TIMESTAMP(3),
ADD COLUMN     "refundClearedById" TEXT;
