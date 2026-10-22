/**
 * Private conversations with the owner: "Talk to the owner" cases and HR's
 * desk with meeting reports. The rules that must always hold:
 *   - only the person who started it and the owner ever see it (not HR, not
 *     managers, never the person a case is about), files included;
 *   - only the owner changes a case's status;
 *   - the sender can take a message back for 5 minutes, then it stays;
 *     taking back a case's first message withdraws the case;
 *   - only HR sends meeting reports.
 * Vercel Blob is mocked; nothing is uploaded.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/generated/prisma/client";
import type { CurrentUser } from "@/server/session";

process.env.ATTACHMENTS_READ_WRITE_TOKEN = "vercel_blob_rw_test_token";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const stored = new Map<string, Uint8Array>();
const head = vi.fn(async (pathname: string) => {
  if (!stored.has(pathname)) throw new Error("Vercel Blob: not found");
  return { size: 40_000 };
});
const get = vi.fn(async (pathname: string) => ({ stream: new Blob([stored.get(pathname)! as BlobPart]).stream() }));
const del = vi.fn(async (paths: string | string[]) => {
  for (const p of [paths].flat()) stored.delete(p);
});
vi.mock("@vercel/blob", () => ({ head, get, del, issueSignedToken: vi.fn(), presignUrl: vi.fn() }));
vi.mock("@vercel/blob/client", () => ({ generateClientTokenFromReadWriteToken: vi.fn(async () => "client-token") }));

const { prisma } = await import("@/lib/prisma");
const { DomainError } = await import("@/server/access");
const { createUploadToken, findViewableAttachment, registerUpload } = await import("@/server/attachments");
const c = await import("@/server/conversations");

async function makeUser(name: string, role: Role): Promise<CurrentUser> {
  const username = `${name.toLowerCase().replace(/\s+/g, "")}${randomUUID().slice(0, 6)}`;
  return prisma.user.create({
    data: { id: randomUUID(), name, email: `${username}@test.local`, username, role },
    select: { id: true, name: true, email: true, username: true, image: true, role: true },
  });
}

async function wipe() {
  await prisma.attachment.deleteMany();
  await prisma.meetingReport.deleteMany();
  await prisma.conversationRead.deleteMany();
  await prisma.conversationMessage.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.taskActivity.deleteMany();
  await prisma.task.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
}

async function upload(user: CurrentUser) {
  const { pathname } = await createUploadToken(user, { type: "image/jpeg", size: 40_000 });
  stored.set(pathname, JPEG);
  return registerUpload(user, pathname, "screenshot.jpg");
}

const concern = (over: Partial<Parameters<typeof c.raiseCase>[1]> = {}) => ({
  subject: "My manager takes credit for my work",
  category: "MANAGER" as const,
  urgency: "NORMAL" as const,
  body: "In the last three client calls my designs were presented as his own.",
  aboutUserId: undefined as string | undefined,
  attachmentIds: [],
  ...over,
});

/** Makes a message look older, to test the 5-minute delete window. */
const age = (messageId: string, minutes: number) =>
  prisma.conversationMessage.update({ where: { id: messageId }, data: { createdAt: new Date(Date.now() - minutes * 60_000) } });

let owner: CurrentUser;
let hr: CurrentUser;
let hr2: CurrentUser;
let mia: CurrentUser; // manager
let alice: CurrentUser; // employee on Mia's team
let bob: CurrentUser; // another employee

beforeEach(async () => {
  await wipe();
  stored.clear();
  vi.clearAllMocks();
  owner = await makeUser("Owen Owner", "ADMIN");
  hr = await makeUser("Hina HR", "HR");
  hr2 = await makeUser("Harsh HR", "HR");
  mia = await makeUser("Mia Manager", "MANAGER");
  alice = await makeUser("Alice Member", "MEMBER");
  bob = await makeUser("Bob Member", "MEMBER");
  await prisma.team.create({ data: { name: "Tech", managerId: mia.id, members: { create: [{ userId: alice.id }] } } });
});

afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

describe("who sees a case", () => {
  it("only whoever raised it and the owner, never HR, managers or the person it's about", async () => {
    const shot = await upload(alice);
    const { id } = await c.raiseCase(alice, concern({ aboutUserId: mia.id, attachmentIds: [shot.id] }));

    expect((await c.getConversation(alice, id)).subject).toBe("My manager takes credit for my work");
    expect((await c.listCasesForOwner(owner)).map((x) => x.id)).toEqual([id]);
    expect(await findViewableAttachment(owner, shot.id)).not.toBeNull();
    expect(await findViewableAttachment(alice, shot.id)).not.toBeNull();

    for (const outsider of [mia, hr, bob]) {
      await expect(c.getConversation(outsider, id)).rejects.toThrow();
      await expect(c.postMessage(outsider, id, { body: "Hello", attachmentIds: [] })).rejects.toThrow(DomainError);
      await expect(c.markRead(outsider, id)).rejects.toThrow(DomainError);
      expect(await c.listMyCases(outsider)).toEqual([]);
      expect(await findViewableAttachment(outsider, shot.id)).toBeNull();
      expect(await c.countUnread(outsider)).toBe(0);
    }
    await expect(c.listCasesForOwner(hr)).rejects.toThrow(DomainError);
  });

  it("the owner can't raise one, and a case can't be about yourself or the owner", async () => {
    await expect(c.raiseCase(owner, concern())).rejects.toThrow(DomainError);
    await expect(c.raiseCase(alice, concern({ aboutUserId: alice.id }))).rejects.toThrow(DomainError);
    await expect(c.raiseCase(alice, concern({ aboutUserId: owner.id }))).rejects.toThrow(DomainError);
    expect(await prisma.conversation.count()).toBe(0);
  });
});

describe("talking it through", () => {
  it("moves along as the owner replies and resolves, and reopens when the raiser writes again", async () => {
    const { id } = await c.raiseCase(bob, concern({ category: "COLLEAGUE" }));
    expect(await c.countUnread(owner)).toBe(1);
    await c.markRead(owner, id);
    expect(await c.countUnread(owner)).toBe(0);

    await c.postMessage(owner, id, { body: "Thanks for telling me. Can we talk tomorrow?", attachmentIds: [] });
    expect((await c.getConversation(bob, id)).status).toBe("IN_DISCUSSION");
    expect(await c.countUnread(bob)).toBe(1);

    await expect(c.setCaseStatus(bob, id, "RESOLVED")).rejects.toThrow(DomainError);
    await c.setCaseStatus(owner, id, "RESOLVED");
    expect((await c.getConversation(bob, id)).status).toBe("RESOLVED");

    const { reopened } = await c.postMessage(bob, id, { body: "It happened again today.", attachmentIds: [] });
    expect(reopened).toBe(true);
    expect((await c.getConversation(owner, id)).status).toBe("OPEN");
  });

  it("shows “Seen” from the other side's read marker", async () => {
    const { id } = await c.raiseCase(alice, concern());
    expect((await c.getConversation(alice, id)).otherReadAt).toBeNull();
    await c.markRead(owner, id);
    const seen = (await c.getConversation(alice, id)).otherReadAt!;
    const [first] = (await c.getConversation(alice, id)).messages;
    expect(seen >= first!.createdAt).toBe(true);
  });

  it("replies quote a message from the same conversation only", async () => {
    const one = await c.raiseCase(alice, concern());
    const two = await c.raiseCase(bob, concern());
    const bobsFirst = (await c.getConversation(bob, two.id)).messages[0]!;
    await expect(
      c.postMessage(owner, one.id, { body: "About this…", attachmentIds: [], replyToId: bobsFirst.id }),
    ).rejects.toThrow(DomainError);
  });
});

describe("taking a message back", () => {
  it("works for your own message in the first 5 minutes, and removes its files", async () => {
    const { id } = await c.raiseCase(alice, concern());
    const shot = await upload(alice);
    const { messageId } = await c.postMessage(alice, id, { body: "Wrong photo, sorry", attachmentIds: [shot.id] });

    await expect(c.deleteMessage(owner, messageId)).rejects.toThrow("You can only delete your own messages.");
    expect(await c.deleteMessage(alice, messageId)).toEqual({ withdrawn: false });

    const msg = (await c.getConversation(owner, id)).messages.find((m) => m.id === messageId)!;
    expect(msg.deletedAt).not.toBeNull();
    expect(msg.body).toBe("");
    expect(await prisma.attachment.count({ where: { id: shot.id } })).toBe(0);
    expect(del).toHaveBeenCalled();
    // The case itself carries on.
    expect((await c.getConversation(owner, id)).status).toBe("OPEN");
  });

  it("is refused after 5 minutes: the message stays on record", async () => {
    const { id } = await c.raiseCase(alice, concern());
    const { messageId } = await c.postMessage(alice, id, { body: "Adding a detail", attachmentIds: [] });
    await age(messageId, 6);
    await expect(c.deleteMessage(alice, messageId)).rejects.toThrow(/first 5 minutes/);
  });

  it("deleting a case's first message withdraws it; then nobody can write or change its status", async () => {
    const { id } = await c.raiseCase(alice, concern());
    const first = (await c.getConversation(alice, id)).messages[0]!;
    expect(await c.deleteMessage(alice, first.id)).toEqual({ withdrawn: true });

    const convo = await c.getConversation(owner, id);
    expect(convo.status).toBe("WITHDRAWN");
    await expect(c.postMessage(owner, id, { body: "Hello?", attachmentIds: [] })).rejects.toThrow(DomainError);
    await expect(c.setCaseStatus(owner, id, "OPEN")).rejects.toThrow(DomainError);
    expect((await c.listCasesForOwner(owner, "withdrawn")).map((x) => x.id)).toEqual([id]);
  });
});

describe("HR's desk and meeting reports", () => {
  const report = (over: Partial<Parameters<typeof c.sendReport>[1]> = {}) => ({
    meetingDate: new Date().toISOString().slice(0, 10),
    title: "Daily stand-up",
    attendeeIds: [mia.id, alice.id],
    discussed: "Client launch slipped a day; hiring for two roles.",
    decisions: "Launch Friday.",
    actionItems: "Mia: update the client.",
    attachmentIds: [],
    ...over,
  });

  it("HR sends reports only the owner reads, and each HR person has their own desk", async () => {
    const { conversationId } = await c.sendReport(hr, report());
    expect((await c.hrDesk(hr)).id).toBe(conversationId); // one desk per HR person

    const seen = await c.getConversation(owner, conversationId);
    expect(seen.messages[0]!.report).toMatchObject({ title: "Daily stand-up", decisions: "Launch Friday." });
    expect(seen.messages[0]!.report!.attendees.map((a) => a.name).sort()).toEqual(["Alice Member", "Mia Manager"]);
    expect((await c.listHrDesks(owner)).map((d) => d.id)).toEqual([conversationId]);
    expect(await c.countUnread(owner)).toBe(1);

    for (const outsider of [hr2, mia, alice]) {
      await expect(c.getConversation(outsider, conversationId)).rejects.toThrow();
    }
    await c.postMessage(owner, conversationId, { body: "Why did the launch slip?", attachmentIds: [] });
    expect(await c.countUnread(hr, "HR_DESK")).toBe(1);
  });

  it("only HR sends reports, and never for a future date", async () => {
    await expect(c.sendReport(mia, report())).rejects.toThrow(DomainError);
    await expect(c.sendReport(owner, report())).rejects.toThrow(DomainError);
    const nextWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    await expect(c.sendReport(hr, report({ meetingDate: nextWeek }))).rejects.toThrow(/future/);
  });

  it("deleting a report in the first 5 minutes removes it, and never withdraws anything", async () => {
    const { conversationId, messageId } = await c.sendReport(hr, report());
    expect(await c.deleteMessage(hr, messageId)).toEqual({ withdrawn: false });
    expect(await prisma.meetingReport.count()).toBe(0);
    expect((await c.getConversation(owner, conversationId)).messages[0]!.deletedAt).not.toBeNull();
  });
});
