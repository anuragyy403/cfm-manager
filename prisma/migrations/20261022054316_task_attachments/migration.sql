-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('IMAGE', 'VIDEO');

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "name" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "pathname" TEXT NOT NULL,
    "activityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attachments_pathname_key" ON "attachments"("pathname");

-- CreateIndex
CREATE INDEX "attachments_activityId_idx" ON "attachments"("activityId");

-- CreateIndex
CREATE INDEX "attachments_uploaderId_createdAt_idx" ON "attachments"("uploaderId", "createdAt");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "task_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
