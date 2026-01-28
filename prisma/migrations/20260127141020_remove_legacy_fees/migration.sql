/*
  Warnings:

  - You are about to drop the column `studentFeeId` on the `PaymentLink` table. All the data in the column will be lost.
  - You are about to drop the column `paymentId` on the `Receipt` table. All the data in the column will be lost.
  - You are about to drop the column `studentFeeId` on the `Receipt` table. All the data in the column will be lost.
  - You are about to drop the `FeePayment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FeePlan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StudentFee` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[installmentPaymentId]` on the table `Receipt` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `installmentPaymentId` to the `Receipt` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "FeePayment" DROP CONSTRAINT "FeePayment_receivedById_fkey";

-- DropForeignKey
ALTER TABLE "FeePayment" DROP CONSTRAINT "FeePayment_studentFeeId_fkey";

-- DropForeignKey
ALTER TABLE "FeePlan" DROP CONSTRAINT "FeePlan_orgId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentLink" DROP CONSTRAINT "PaymentLink_studentFeeId_fkey";

-- DropForeignKey
ALTER TABLE "Receipt" DROP CONSTRAINT "Receipt_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "StudentFee" DROP CONSTRAINT "StudentFee_feePlanId_fkey";

-- DropForeignKey
ALTER TABLE "StudentFee" DROP CONSTRAINT "StudentFee_studentId_fkey";

-- DropIndex
DROP INDEX "PaymentLink_studentFeeId_idx";

-- DropIndex
DROP INDEX "Receipt_paymentId_key";

-- AlterTable
ALTER TABLE "PaymentLink" DROP COLUMN "studentFeeId";

-- AlterTable
ALTER TABLE "Receipt" DROP COLUMN "paymentId",
DROP COLUMN "studentFeeId",
ADD COLUMN     "installmentPaymentId" TEXT NOT NULL;

-- DropTable
DROP TABLE "FeePayment";

-- DropTable
DROP TABLE "FeePlan";

-- DropTable
DROP TABLE "StudentFee";

-- DropEnum
DROP TYPE "FeeFrequency";

-- DropEnum
DROP TYPE "FeeStatus";

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_installmentPaymentId_key" ON "Receipt"("installmentPaymentId");

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_installmentPaymentId_fkey" FOREIGN KEY ("installmentPaymentId") REFERENCES "InstallmentPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
