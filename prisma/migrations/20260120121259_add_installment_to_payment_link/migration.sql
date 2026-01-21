-- DropForeignKey
ALTER TABLE "PaymentLink" DROP CONSTRAINT "PaymentLink_studentFeeId_fkey";

-- AlterTable
ALTER TABLE "PaymentLink" ADD COLUMN     "installmentId" TEXT,
ALTER COLUMN "studentFeeId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "PaymentLink_installmentId_idx" ON "PaymentLink"("installmentId");

-- AddForeignKey
ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_studentFeeId_fkey" FOREIGN KEY ("studentFeeId") REFERENCES "StudentFee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "FeeInstallment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
