import "server-only";
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { canStillDelete, isUnread } from "@/lib/conversations";
import { prisma } from "@/lib/prisma";
import type { CaseInput, MessageInput, ReportInput } from "@/lib/validation";
import { canSeeConversation, conversationScope, DomainError, isHR, isOwner } from "@/server/access";
import { attachmentViewSelect, claimDrafts, deleteStoredFiles } from "@/server/attachments";
import type { CurrentUser } from "@/server/session";

/**
 * Private conversations with the owner.
 *   - Cases ("Talk to the owner"): anyone but the owner raises one about a
 *     problem. Only they and the owner see it, never the person it's about.
 *   - HR desks: each HR person's private channel with the owner, for meeting
 *     reports and messages.
 * Who sees what is decided by `canSeeConversation` / `conversationScope` in
 * `src/server/access.ts`. Callers pass an already-verified user.
 */

const personSelect = { id: true, name: true, image: true, role: true, deletedAt: true } as const;

export const messageSelect = {
  id: true,
  body: true,
  createdAt: true,
  deletedAt: true,
  authorId: true,
  author: { select: personSelect },
  attachments: { select: attachmentViewSelect, orderBy: { createdAt: "asc" } },
  replyTo: {
    select: { id: true, body: true, deletedAt: true, author: { select: { name: true } }, report: { select: { title: true } } },
  },
  report: {
    select: {
      meetingDate: true,
      title: true,
      discussed: true,
      decisions: true,
      actionItems: true,
      attendees: { select: { id: true, name: true, image: true }, orderBy: { name: "asc" } },
    },
  },
} satisfies Prisma.ConversationMessageSelect;

export type ThreadMessage = Prisma.ConversationMessageGetPayload<{ select: typeof messageSelect }>;

/** How many recent messages a thread page shows. */
const THREAD_LIMIT = 300;

/** The company owner, who every conversation is with. */
export async function findOwner() {
  return prisma.user.findFirst({ where: { role: "ADMIN", deletedAt: null }, select: { id: true, name: true, image: true } });
}

/** Loads a conversation the viewer can see, or 404s. */
async function visibleConversation(viewer: CurrentUser, id: string) {
  const convo = await prisma.conversation.findUnique({
    where: { id },
    select: { id: true, kind: true, creatorId: true, status: true },
  });
  if (!convo || !canSeeConversation(viewer, convo)) throw new DomainError("Conversation not found.");
  return convo;
}

/** Records the sender as having read up to their own message, and moves the unread marker. */
async function afterPost(tx: Prisma.TransactionClient, conversationId: string, authorId: string, at: Date) {
  await tx.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: at, lastMessageAuthorId: authorId },
  });
  await tx.conversationRead.upsert({
    where: { conversationId_userId: { conversationId, userId: authorId } },
    create: { conversationId, userId: authorId, lastReadAt: at },
    update: { lastReadAt: at },
  });
}

// ─── Reading ────────────────────────────────────────────────────────────────

const caseListSelect = {
  id: true,
  subject: true,
  category: true,
  urgency: true,
  status: true,
  createdAt: true,
  lastMessageAt: true,
  lastMessageAuthorId: true,
  creator: { select: { ...personSelect, memberships: { select: { team: { select: { name: true } } } } } },
  aboutUser: { select: { id: true, name: true, deletedAt: true } },
  _count: { select: { messages: { where: { deletedAt: null } } } },
} satisfies Prisma.ConversationSelect;

function withUnread<T extends { lastMessageAt: Date; lastMessageAuthorId: string | null }>(
  viewer: CurrentUser,
  rows: (T & { reads: { lastReadAt: Date }[] })[],
) {
  return rows.map(({ reads, ...row }) => ({
    ...(row as unknown as T),
    unread: isUnread(row, viewer.id, reads[0]?.lastReadAt),
  }));
}

/** The cases someone raised, newest activity first. */
export async function listMyCases(viewer: CurrentUser) {
  const rows = await prisma.conversation.findMany({
    where: { kind: "OWNER_CASE", creatorId: viewer.id },
    select: { ...caseListSelect, reads: { where: { userId: viewer.id }, select: { lastReadAt: true } } },
    orderBy: { lastMessageAt: "desc" },
  });
  return withUnread(viewer, rows);
}

export type CaseFilter = "active" | "resolved" | "withdrawn";

const FILTER_STATUSES: Record<CaseFilter, Prisma.ConversationWhereInput["status"]> = {
  active: { in: ["OPEN", "IN_DISCUSSION"] },
  resolved: "RESOLVED",
  withdrawn: "WITHDRAWN",
};

/** Every case, for the owner's inbox: urgent and unread first within each view. */
export async function listCasesForOwner(owner: CurrentUser, filter: CaseFilter = "active") {
  if (!isOwner(owner)) throw new DomainError("Only the owner sees every case.");
  const rows = await prisma.conversation.findMany({
    where: { kind: "OWNER_CASE", status: FILTER_STATUSES[filter] },
    select: { ...caseListSelect, reads: { where: { userId: owner.id }, select: { lastReadAt: true } } },
    orderBy: { lastMessageAt: "desc" },
    take: 300,
  });
  return withUnread(owner, rows);
}

export async function countCasesByFilter() {
  const groups = await prisma.conversation.groupBy({ by: ["status"], where: { kind: "OWNER_CASE" }, _count: true });
  const of = (s: string) => groups.find((g) => g.status === s)?._count ?? 0;
  return { active: of("OPEN") + of("IN_DISCUSSION"), resolved: of("RESOLVED"), withdrawn: of("WITHDRAWN") };
}

/** One conversation with its recent messages, for its page. 404 for anyone who can't see it. */
export async function getConversation(viewer: CurrentUser, id: string) {
  const convo = await prisma.conversation.findFirst({
    where: { id, ...conversationScope(viewer) },
    select: {
      id: true,
      kind: true,
      subject: true,
      category: true,
      urgency: true,
      status: true,
      resolvedAt: true,
      createdAt: true,
      lastMessageAt: true,
      creatorId: true,
      creator: {
        select: { ...personSelect, email: true, memberships: { select: { team: { select: { name: true } } } } },
      },
      aboutUser: { select: { id: true, name: true, role: true, deletedAt: true } },
      reads: { select: { userId: true, lastReadAt: true } },
      messages: { select: messageSelect, orderBy: { createdAt: "desc" }, take: THREAD_LIMIT },
    },
  });
  if (!convo) notFound();
  const firstMessageId = (
    await prisma.conversationMessage.findFirst({ where: { conversationId: id }, orderBy: { createdAt: "asc" }, select: { id: true } })
  )?.id;
  // Only the creator and the owner can read it, so the other read marker is the other side's ("Seen").
  const otherReadAt = convo.reads.find((r) => r.userId !== viewer.id)?.lastReadAt ?? null;
  return { ...convo, messages: convo.messages.reverse(), firstMessageId, otherReadAt };
}

/** How many conversations have something the viewer hasn't read (sidebar badges). */
export async function countUnread(viewer: CurrentUser, kind?: "OWNER_CASE" | "HR_DESK") {
  const rows = await prisma.conversation.findMany({
    where: { ...conversationScope(viewer), ...(kind ? { kind } : {}), lastMessageAuthorId: { not: viewer.id } },
    select: { lastMessageAt: true, lastMessageAuthorId: true, reads: { where: { userId: viewer.id }, select: { lastReadAt: true } } },
  });
  return rows.filter((r) => isUnread(r, viewer.id, r.reads[0]?.lastReadAt)).length;
}

/** Marks a conversation as read up to now by the viewer. */
export async function markRead(viewer: CurrentUser, conversationId: string) {
  await visibleConversation(viewer, conversationId);
  const now = new Date();
  await prisma.conversationRead.upsert({
    where: { conversationId_userId: { conversationId, userId: viewer.id } },
    create: { conversationId, userId: viewer.id, lastReadAt: now },
    update: { lastReadAt: now },
  });
}

/** People a case can be about: anyone active except the owner and the person raising it. */
export async function listCaseSubjects(viewer: CurrentUser) {
  return prisma.user.findMany({
    where: { deletedAt: null, role: { not: "ADMIN" }, id: { not: viewer.id } },
    select: { id: true, name: true, image: true, role: true },
    orderBy: { name: "asc" },
  });
}

/** People who can be listed as at a meeting: everyone active. */
export async function listMeetingAttendeeOptions() {
  return prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, image: true, role: true },
    orderBy: { name: "asc" },
  });
}

/** Storage the attachments take up, for the owner's storage meter. */
export async function attachmentStorageBytes() {
  const sum = await prisma.attachment.aggregate({ _sum: { size: true } });
  return sum._sum.size ?? 0;
}

// ─── Cases ──────────────────────────────────────────────────────────────────

/** Raises a case with the owner. The first message is what happened. */
export async function raiseCase(viewer: CurrentUser, input: CaseInput) {
  if (isOwner(viewer)) throw new DomainError("The owner can't raise a case with themselves.");
  if (input.aboutUserId) {
    if (input.aboutUserId === viewer.id) throw new DomainError("Choose someone other than yourself.");
    const about = await prisma.user.findFirst({ where: { id: input.aboutUserId, deletedAt: null }, select: { role: true } });
    if (!about) throw new DomainError("That person isn't in the company any more.");
    if (about.role === "ADMIN") throw new DomainError("This goes straight to the owner, so leave “Who is it about?” empty.");
  }
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const convo = await tx.conversation.create({
      data: {
        kind: "OWNER_CASE",
        creatorId: viewer.id,
        subject: input.subject,
        category: input.category,
        urgency: input.urgency,
        aboutUserId: input.aboutUserId ?? null,
        status: "OPEN",
        lastMessageAt: now,
        lastMessageAuthorId: viewer.id,
      },
      select: { id: true },
    });
    const message = await tx.conversationMessage.create({
      data: { conversationId: convo.id, authorId: viewer.id, body: input.body, createdAt: now },
      select: { id: true },
    });
    await claimDrafts(tx, viewer, input.attachmentIds, { messageId: message.id });
    await afterPost(tx, convo.id, viewer.id, now);
    return convo;
  });
}

/**
 * The owner moves a case along: in discussion, resolved, or reopened.
 * A withdrawn case stays withdrawn.
 */
export async function setCaseStatus(viewer: CurrentUser, id: string, status: "OPEN" | "IN_DISCUSSION" | "RESOLVED") {
  if (!isOwner(viewer)) throw new DomainError("Only the owner can change a case's status.");
  const convo = await visibleConversation(viewer, id);
  if (convo.kind !== "OWNER_CASE") throw new DomainError("Only cases have a status.");
  if (convo.status === "WITHDRAWN") throw new DomainError("This case was withdrawn by whoever raised it.");
  await prisma.conversation.update({
    where: { id },
    data: { status, resolvedAt: status === "RESOLVED" ? new Date() : null },
  });
  return { previous: convo.status };
}

// ─── Messages ───────────────────────────────────────────────────────────────

/**
 * Posts a message in a conversation the viewer is part of. On a case, the
 * owner's first reply moves it to "in discussion", and a new message from
 * whoever raised it reopens a resolved one.
 */
export async function postMessage(viewer: CurrentUser, conversationId: string, input: MessageInput) {
  const convo = await visibleConversation(viewer, conversationId);
  if (convo.status === "WITHDRAWN") throw new DomainError("This case was withdrawn, so it can't get new messages.");
  if (input.replyToId) {
    const quoted = await prisma.conversationMessage.count({
      where: { id: input.replyToId, conversationId, deletedAt: null },
    });
    if (!quoted) throw new DomainError("The message you replied to was deleted.");
  }

  let status: "IN_DISCUSSION" | "OPEN" | undefined;
  if (convo.kind === "OWNER_CASE") {
    if (isOwner(viewer) && convo.status === "OPEN") status = "IN_DISCUSSION";
    if (!isOwner(viewer) && convo.status === "RESOLVED") status = "OPEN";
  }

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const message = await tx.conversationMessage.create({
      data: { conversationId, authorId: viewer.id, body: input.body, replyToId: input.replyToId ?? null, createdAt: now },
      select: { id: true },
    });
    await claimDrafts(tx, viewer, input.attachmentIds, { messageId: message.id });
    if (status) {
      await tx.conversation.update({ where: { id: conversationId }, data: { status, resolvedAt: null } });
    }
    await afterPost(tx, conversationId, viewer.id, now);
    return { messageId: message.id, reopened: status === "OPEN" };
  });
}

/**
 * The sender takes a message back, within minutes of sending it. Its text and
 * files are removed and a "deleted" placeholder stays. Taking back the first
 * message of a case withdraws the whole case.
 */
export async function deleteMessage(viewer: CurrentUser, messageId: string) {
  const message = await prisma.conversationMessage.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      authorId: true,
      createdAt: true,
      deletedAt: true,
      conversationId: true,
      conversation: { select: { kind: true, creatorId: true, status: true } },
      attachments: { select: { id: true, pathname: true } },
    },
  });
  if (!message || !canSeeConversation(viewer, message.conversation)) throw new DomainError("Message not found.");
  if (message.authorId !== viewer.id) throw new DomainError("You can only delete your own messages.");
  if (message.deletedAt) return { withdrawn: false };
  if (!canStillDelete(message.createdAt)) {
    throw new DomainError("Messages can only be deleted in the first 5 minutes. This one stays on record.");
  }

  const first = await prisma.conversationMessage.findFirst({
    where: { conversationId: message.conversationId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const withdraws =
    message.conversation.kind === "OWNER_CASE" && first?.id === message.id && message.conversation.creatorId === viewer.id;

  await prisma.$transaction(async (tx) => {
    await tx.conversationMessage.update({ where: { id: message.id }, data: { body: "", deletedAt: new Date() } });
    await tx.attachment.deleteMany({ where: { messageId: message.id } });
    await tx.meetingReport.deleteMany({ where: { messageId: message.id } });
    if (withdraws) {
      await tx.conversation.update({ where: { id: message.conversationId }, data: { status: "WITHDRAWN", resolvedAt: null } });
    }
  });
  await deleteStoredFiles(message.attachments.map((a) => a.pathname));
  return { withdrawn: withdraws };
}

// ─── HR desk and meeting reports ────────────────────────────────────────────

/** HR's private channel with the owner, created the first time it's needed. */
export async function hrDesk(hr: CurrentUser) {
  if (!isHR(hr)) throw new DomainError("Only HR has a desk with the owner.");
  const deskKey = `hr:${hr.id}`;
  return prisma.conversation.upsert({
    where: { deskKey },
    create: { kind: "HR_DESK", creatorId: hr.id, deskKey, status: "IN_DISCUSSION" },
    update: {},
    select: { id: true },
  });
}

/** HR's desks, for the owner: one per HR person, with the latest report. */
export async function listHrDesks(owner: CurrentUser) {
  if (!isOwner(owner)) throw new DomainError("Only the owner sees HR's desks.");
  const rows = await prisma.conversation.findMany({
    where: { kind: "HR_DESK" },
    select: {
      id: true,
      lastMessageAt: true,
      lastMessageAuthorId: true,
      creator: { select: personSelect },
      reads: { where: { userId: owner.id }, select: { lastReadAt: true } },
      messages: {
        where: { deletedAt: null, report: { isNot: null } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, report: { select: { title: true, meetingDate: true } } },
      },
      _count: { select: { messages: { where: { deletedAt: null, report: { isNot: null } } } } },
    },
    orderBy: { lastMessageAt: "desc" },
  });
  return withUnread(owner, rows);
}

/** HR sends the owner a meeting report, as a card in HR's desk. */
export async function sendReport(hr: CurrentUser, input: ReportInput) {
  const desk = await hrDesk(hr);
  const meetingDate = new Date(`${input.meetingDate}T00:00:00.000Z`);
  if (meetingDate.getTime() > Date.now() + 36 * 60 * 60 * 1000) {
    throw new DomainError("The meeting date can't be in the future.");
  }
  const attendeeIds = [...new Set(input.attendeeIds)];
  if (attendeeIds.length) {
    const found = await prisma.user.count({ where: { id: { in: attendeeIds }, deletedAt: null } });
    if (found !== attendeeIds.length) throw new DomainError("Someone on the attendee list isn't in the company any more.");
  }
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const message = await tx.conversationMessage.create({
      data: {
        conversationId: desk.id,
        authorId: hr.id,
        createdAt: now,
        report: {
          create: {
            meetingDate,
            title: input.title,
            discussed: input.discussed,
            decisions: input.decisions,
            actionItems: input.actionItems,
            attendees: { connect: attendeeIds.map((id) => ({ id })) },
          },
        },
      },
      select: { id: true },
    });
    await claimDrafts(tx, hr, input.attachmentIds, { messageId: message.id });
    await afterPost(tx, desk.id, hr.id, now);
    return { conversationId: desk.id, messageId: message.id };
  });
}
