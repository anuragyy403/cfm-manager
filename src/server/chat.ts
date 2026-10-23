import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { MESSAGE_DELETE_WINDOW_MS } from "@/lib/conversations";
import { DomainError } from "@/server/access";
import { attachmentViewSelect, claimDrafts, deleteStoredFiles } from "@/server/attachments";
import type { CurrentUser } from "@/server/session";

const personSelect = { id: true, name: true, image: true, role: true, deletedAt: true } as const;
export const chatScope = (user: CurrentUser) => ({ OR: [{ firstId: user.id }, { secondId: user.id }] });

export async function listChatPeople(user: CurrentUser) {
  return prisma.user.findMany({
    where: { deletedAt: null, id: { not: user.id } },
    select: personSelect,
    orderBy: { name: "asc" },
  });
}

export async function listChats(user: CurrentUser) {
  const chats = await prisma.employeeChat.findMany({
    where: chatScope(user),
    include: {
      first: { select: personSelect }, second: { select: personSelect },
      messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { body: true, deletedAt: true, createdAt: true, authorId: true } },
    },
    orderBy: { lastMessageAt: "desc" },
  });
  return chats.map((chat) => {
    const last = chat.messages[0];
    const readAt = chat.firstId === user.id ? chat.firstReadAt : chat.secondReadAt;
    return {
      id: chat.id,
      person: chat.firstId === user.id ? chat.second : chat.first,
      preview: last ? last.deletedAt ? "Message deleted" : last.body || "Attachment" : "Start a conversation",
      unread: !!last && last.authorId !== user.id && (!readAt || last.createdAt > readAt),
    };
  });
}

/** Sorted unique pair makes opening the same chat from either side idempotent. */
export async function openChat(user: CurrentUser, personId: string) {
  if (personId === user.id) throw new DomainError("Choose another person to chat with.");
  const person = await prisma.user.findFirst({ where: { id: personId, deletedAt: null }, select: { id: true } });
  if (!person) throw new DomainError("This person is no longer available for chat.");
  const [firstId, secondId] = [user.id, personId].sort();
  const where = { firstId_secondId: { firstId, secondId } };
  try {
    return await prisma.employeeChat.upsert({ where, create: { firstId, secondId }, update: {}, select: { id: true } });
  } catch (error) {
    // Prisma may emulate a compound-key upsert: another participant can win
    // the insert between its read and write. Return that same thread.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.employeeChat.findUniqueOrThrow({ where, select: { id: true } });
    }
    throw error;
  }
}

export async function getChat(user: CurrentUser, id: string, before?: string) {
  const chat = await prisma.employeeChat.findFirst({
    where: { id, ...chatScope(user) },
    include: { first: { select: personSelect }, second: { select: personSelect } },
  });
  if (!chat) return null;
  // A cursor is accepted only if it belongs to this conversation.
  const cursor = before ? await prisma.employeeChatMessage.findFirst({ where: { id: before, chatId: id }, select: { id: true } }) : null;
  const messages = await prisma.employeeChatMessage.findMany({
    where: { chatId: id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 51,
    ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}),
    include: { author: { select: personSelect }, attachments: { select: attachmentViewSelect } },
  });
  const hasOlder = messages.length > 50;
  const page = messages.slice(0, 50).reverse();
  return { id, person: chat.firstId === user.id ? chat.second : chat.first, messages: page, hasOlder, readThrough: page.at(-1)?.createdAt ?? null };
}

export async function sendChatMessage(user: CurrentUser, id: string, input: { body: string; attachmentIds: string[] }) {
  return prisma.$transaction(async (tx) => {
    const chat = await tx.employeeChat.findFirst({
      where: { id, ...chatScope(user), first: { deletedAt: null }, second: { deletedAt: null } }, select: { id: true },
    });
    if (!chat) throw new DomainError("This chat is unavailable. Choose an active employee.");
    const message = await tx.employeeChatMessage.create({ data: { chatId: id, authorId: user.id, body: input.body } });
    await claimDrafts(tx, user, input.attachmentIds, { chatMessageId: message.id });
    await tx.employeeChat.update({ where: { id }, data: { lastMessageAt: message.createdAt } });
  });
}

/** Read only through the messages actually rendered, never a later unseen arrival. */
export async function markChatRead(user: CurrentUser, id: string, through: Date) {
  if (through > new Date()) return;
  const ownField = await prisma.employeeChat.findFirst({ where: { id, ...chatScope(user) }, select: { firstId: true } });
  if (!ownField) throw new DomainError("Chat not found.");
  const field = ownField.firstId === user.id ? "firstReadAt" : "secondReadAt";
  await prisma.employeeChat.updateMany({
    where: { id, AND: [chatScope(user), { OR: [{ [field]: null }, { [field]: { lt: through } }] }] },
    data: { [field]: through },
  });
}

export async function deleteChatMessage(user: CurrentUser, id: string) {
  const paths = await prisma.$transaction(async (tx) => {
    const message = await tx.employeeChatMessage.findFirst({
      where: { id, authorId: user.id, deletedAt: null, chat: chatScope(user) }, include: { attachments: { select: { pathname: true } } },
    });
    if (!message || Date.now() - message.createdAt.getTime() > MESSAGE_DELETE_WINDOW_MS) {
      throw new DomainError("You can delete only your own messages within five minutes of sending.");
    }
    await tx.employeeChatMessage.update({ where: { id }, data: { body: "", deletedAt: new Date() } });
    await tx.attachment.deleteMany({ where: { chatMessageId: id } });
    return message.attachments.map((a) => a.pathname);
  });
  await deleteStoredFiles(paths);
}
