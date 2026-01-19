-- AlterTable
ALTER TABLE "PeriodTemplate" ADD COLUMN     "activeDays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5, 6]::INTEGER[];
