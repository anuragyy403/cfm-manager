ALTER TYPE "AttachmentKind" ADD VALUE 'FILE';

CREATE TABLE "employee_chats" (
  "id" TEXT NOT NULL,
  "firstId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "secondId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "firstReadAt" TIMESTAMP(3),
  "secondReadAt" TIMESTAMP(3),
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_chats_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employee_chats_ordered_pair" CHECK ("firstId" COLLATE "C" < "secondId" COLLATE "C")
);
CREATE UNIQUE INDEX "employee_chats_firstId_secondId_key" ON "employee_chats"("firstId", "secondId");
CREATE INDEX "employee_chats_secondId_lastMessageAt_idx" ON "employee_chats"("secondId", "lastMessageAt");

CREATE TABLE "employee_chat_messages" (
  "id" TEXT NOT NULL,
  "chatId" TEXT NOT NULL REFERENCES "employee_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "authorId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "body" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "employee_chat_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "employee_chat_messages_chatId_createdAt_id_idx" ON "employee_chat_messages"("chatId", "createdAt", "id");

ALTER TABLE "attachments" ADD COLUMN "chatMessageId" TEXT;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_chatMessageId_fkey" FOREIGN KEY ("chatMessageId") REFERENCES "employee_chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "attachments_chatMessageId_idx" ON "attachments"("chatMessageId");
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_one_parent" CHECK (num_nonnulls("activityId", "messageId", "chatMessageId") <= 1);
