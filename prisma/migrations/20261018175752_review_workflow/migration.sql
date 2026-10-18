-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TaskActivityType" ADD VALUE 'SUBMITTED';
ALTER TYPE "TaskActivityType" ADD VALUE 'PASSED';
ALTER TYPE "TaskActivityType" ADD VALUE 'FAILED';

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'SUBMITTED';

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "timesFailed" INTEGER NOT NULL DEFAULT 0;

-- Work completed before reviews existed: treat the completion time as the
-- hand-in time, so on-time results for old tasks don't change.
UPDATE "tasks" SET "submittedAt" = "completedAt" WHERE "status" = 'COMPLETED' AND "completedAt" IS NOT NULL;
