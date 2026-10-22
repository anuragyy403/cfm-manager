-- CreateEnum
CREATE TYPE "ConversationKind" AS ENUM ('OWNER_CASE', 'HR_DESK');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('OPEN', 'IN_DISCUSSION', 'RESOLVED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "CaseCategory" AS ENUM ('COLLEAGUE', 'MANAGER', 'WORKLOAD', 'CONDUCT', 'OTHER');

-- CreateEnum
CREATE TYPE "CaseUrgency" AS ENUM ('NORMAL', 'URGENT');

-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "messageId" TEXT;

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "kind" "ConversationKind" NOT NULL,
    "creatorId" TEXT NOT NULL,
    "subject" TEXT,
    "category" "CaseCategory",
    "urgency" "CaseUrgency",
    "aboutUserId" TEXT,
    "status" "CaseStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "deskKey" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAuthorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "replyToId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_reports" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "meetingDate" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "discussed" TEXT NOT NULL,
    "decisions" TEXT NOT NULL DEFAULT '',
    "actionItems" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "meeting_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_reads" (
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_reads_pkey" PRIMARY KEY ("conversationId","userId")
);

-- CreateTable
CREATE TABLE "_MeetingAttendees" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MeetingAttendees_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversations_deskKey_key" ON "conversations"("deskKey");

-- CreateIndex
CREATE INDEX "conversations_kind_lastMessageAt_idx" ON "conversations"("kind", "lastMessageAt");

-- CreateIndex
CREATE INDEX "conversations_creatorId_idx" ON "conversations"("creatorId");

-- CreateIndex
CREATE INDEX "conversation_messages_conversationId_createdAt_idx" ON "conversation_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_reports_messageId_key" ON "meeting_reports"("messageId");

-- CreateIndex
CREATE INDEX "_MeetingAttendees_B_index" ON "_MeetingAttendees"("B");

-- CreateIndex
CREATE INDEX "attachments_messageId_idx" ON "attachments"("messageId");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "conversation_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_aboutUserId_fkey" FOREIGN KEY ("aboutUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "conversation_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_reports" ADD CONSTRAINT "meeting_reports_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "conversation_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_reads" ADD CONSTRAINT "conversation_reads_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_reads" ADD CONSTRAINT "conversation_reads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MeetingAttendees" ADD CONSTRAINT "_MeetingAttendees_A_fkey" FOREIGN KEY ("A") REFERENCES "meeting_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MeetingAttendees" ADD CONSTRAINT "_MeetingAttendees_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
