-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'MANAGER';

-- AlterEnum
ALTER TYPE "TaskActivityType" ADD VALUE 'SUBTASK_ADDED';

-- DropIndex
DROP INDEX "team_members_userId_idx";

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "tasks_parentId_idx" ON "tasks"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_userId_key" ON "team_members"("userId");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

