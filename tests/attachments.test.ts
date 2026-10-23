/**
 * Photo and video attachments on submissions and reviews: uploads land only
 * in the uploader's own folder, only real photos / videos are kept, only the
 * uploader can attach their drafts, and only people who can see the task can
 * open its files. Vercel Blob is mocked; nothing is uploaded.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/generated/prisma/client";
import type { CurrentUser } from "@/server/session";

process.env.ATTACHMENTS_READ_WRITE_TOKEN = "vercel_blob_rw_test_token";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const MP4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]);
/** What the mocked store holds: pathname → first bytes and size. */
const stored = new Map<string, { bytes: Uint8Array; size: number }>();

const head = vi.fn(async (pathname: string) => {
  const file = stored.get(pathname);
  if (!file) throw new Error("Vercel Blob: The requested blob does not exist");
  return { size: file.size };
});
const get = vi.fn(async (pathname: string) => {
  const file = stored.get(pathname);
  if (!file) return null;
  return { stream: new Blob([file.bytes as BlobPart]).stream() };
});
const del = vi.fn(async (paths: string | string[]) => {
  for (const p of [paths].flat()) stored.delete(p);
});
const issueSignedToken = vi.fn(async () => ({ delegationToken: "d", clientSigningToken: "c", validUntil: Date.now() + 3 * 3600_000 }));
const presignUrl = vi.fn(async (_key: unknown, o: { pathname: string }) => ({
  presignedUrl: `https://store.private.blob.vercel-storage.com/${o.pathname}?sig=1`,
}));
const generateClientTokenFromReadWriteToken = vi.fn(async () => "client-token");
vi.mock("@vercel/blob", () => ({ head, get, del, issueSignedToken, presignUrl }));
vi.mock("@vercel/blob/client", () => ({ generateClientTokenFromReadWriteToken }));

const { prisma } = await import("@/lib/prisma");
const { MAX_VIDEO_BYTES } = await import("@/lib/attachments");
const { DomainError } = await import("@/server/access");
const { createUploadToken, discardDraft, findViewableAttachment, registerUpload, signedFileUrl } = await import(
  "@/server/attachments"
);
const { createTask, deleteTask, getMyTask, getTask, reviewTask, submitMyTask } = await import("@/server/tasks");

async function makeUser(name: string, role: Role): Promise<CurrentUser> {
  const username = `${name.toLowerCase().replace(/\s+/g, "")}${randomUUID().slice(0, 6)}`;
  return prisma.user.create({
    data: { id: randomUUID(), name, email: `${username}@test.local`, username, role },
    select: { id: true, name: true, email: true, username: true, image: true, role: true },
  });
}

async function wipe() {
  await prisma.attachment.deleteMany();
  await prisma.taskActivity.deleteMany();
  await prisma.task.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
}

/** Uploads a file the way the browser does: token, "upload", then register. */
async function upload(user: CurrentUser, bytes = JPEG, type = "image/jpeg", size = 40_000) {
  const { pathname } = await createUploadToken(user, { type, size });
  stored.set(pathname, { bytes, size });
  return registerUpload(user, pathname, "proof.jpg");
}

let owner: CurrentUser;
let mia: CurrentUser; // manages Tech
let noah: CurrentUser; // manages Business
let alice: CurrentUser; // Tech
let bob: CurrentUser; // Tech
let tech: string;
let taskId: string;

beforeEach(async () => {
  await wipe();
  stored.clear();
  vi.clearAllMocks();
  owner = await makeUser("Owen Owner", "ADMIN");
  mia = await makeUser("Mia Manager", "MANAGER");
  noah = await makeUser("Noah Manager", "MANAGER");
  alice = await makeUser("Alice Member", "MEMBER");
  bob = await makeUser("Bob Member", "MEMBER");
  tech = (
    await prisma.team.create({
      data: { name: "Tech", managerId: mia.id, members: { create: [{ userId: alice.id }, { userId: bob.id }] } },
    })
  ).id;
  await prisma.team.create({ data: { name: "Business", managerId: noah.id } });
  taskId = (
    await createTask(mia, {
      title: "Redesign the landing page",
      description: "",
      priority: "HIGH",
      dueAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      assigneeId: alice.id,
      teamId: tech,
    })
  ).id;
});

afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

describe("uploading", () => {
  it("hands out tokens for supported media and documents within the size limits, in the uploader's own folder", async () => {
    const { pathname } = await createUploadToken(alice, { type: "video/quicktime", size: 20_000_000 });
    expect(pathname).toMatch(new RegExp(`^local/${alice.id}/[0-9a-f]{32}\\.mp4$`));
    expect(generateClientTokenFromReadWriteToken).toHaveBeenCalledWith(
      expect.objectContaining({ pathname, allowedContentTypes: ["video/mp4"], maximumSizeInBytes: MAX_VIDEO_BYTES }),
    );
    await expect(createUploadToken(alice, { type: "video/mp4", size: MAX_VIDEO_BYTES + 1 })).rejects.toThrow(/50 MB/);
    await expect(createUploadToken(alice, { type: "application/pdf", size: 1000 })).resolves.toMatchObject({ contentType: "application/pdf" });
    await expect(createUploadToken(alice, { type: "application/pdf", size: 25 * 1024 * 1024 + 1 })).rejects.toThrow(/25 MB/);
    await expect(createUploadToken(alice, { type: "image/svg+xml", size: 1000 })).rejects.toThrow(DomainError);
  });

  it("keeps only real photos and videos, whatever the file claims to be", async () => {
    const photo = await upload(alice);
    expect(photo).toMatchObject({ kind: "IMAGE", name: "proof.jpg" });
    const video = await upload(alice, MP4, "video/mp4", 5_000_000);
    expect(video.kind).toBe("VIDEO");

    const { pathname } = await createUploadToken(alice, { type: "image/jpeg", size: 100 });
    stored.set(pathname, { bytes: new TextEncoder().encode("<svg onload=alert(1)>"), size: 100 });
    await expect(registerUpload(alice, pathname, "x.jpg")).rejects.toThrow(DomainError);
    expect(stored.has(pathname)).toBe(false); // the fake is removed from storage
  });

  it("refuses to register a file from someone else's folder", async () => {
    const { pathname } = await createUploadToken(bob, { type: "image/jpeg", size: 100 });
    stored.set(pathname, { bytes: JPEG, size: 100 });
    await expect(registerUpload(alice, pathname, "x.jpg")).rejects.toThrow("That upload isn't yours.");
    await expect(registerUpload(alice, `local/${alice.id}/../${bob.id}/a.jpg`, "x.jpg")).rejects.toThrow(DomainError);
  });

  it("validates document signatures and prevents documents being attached to task submissions", async () => {
    const pdf = await upload(alice, new TextEncoder().encode("%PDF-1.7\n"), "application/pdf", 1000);
    expect(pdf.kind).toBe("FILE");
    await expect(submitMyTask(alice, taskId, "Document", [pdf.id])).rejects.toThrow(DomainError);
    const { pathname } = await createUploadToken(alice, { type: "application/pdf", size: 100 });
    stored.set(pathname, { bytes: JPEG, size: 100 });
    await expect(registerUpload(alice, pathname, "fake.pdf")).rejects.toThrow(DomainError);
  });

  it("people discard only their own drafts", async () => {
    const draft = await upload(alice);
    await discardDraft(bob, draft.id);
    expect(await prisma.attachment.count()).toBe(1);
    await discardDraft(alice, draft.id);
    expect(await prisma.attachment.count()).toBe(0);
  });
});

describe("attaching to submissions and reviews", () => {
  it("the assignee hands in photos and videos, and the reviewer answers with their own", async () => {
    const shot = await upload(alice);
    const clip = await upload(alice, MP4, "video/mp4", 4_000_000);
    await submitMyTask(alice, taskId, "Done, see the screenshots", [shot.id, clip.id]);

    const mine = await getMyTask(alice, taskId);
    const submitted = mine.activities.find((a) => a.type === "SUBMITTED")!;
    expect(submitted.attachments.map((a) => a.id)).toEqual([shot.id, clip.id]);

    const fix = await upload(mia);
    await reviewTask(mia, taskId, "FAIL", "The header overlaps on phones", [fix.id]);
    const seenByMia = await getTask(mia, taskId);
    expect(seenByMia.activities.find((a) => a.type === "FAILED")!.attachments.map((a) => a.id)).toEqual([fix.id]);

    // Each round keeps its own files: the resubmission has new ones, the first stays as it was.
    const again = await upload(alice);
    await submitMyTask(alice, taskId, "Fixed the header", [again.id]);
    const rounds = (await getTask(mia, taskId)).activities.filter((a) => a.type === "SUBMITTED");
    expect(rounds.map((r) => r.attachments.map((a) => a.id))).toEqual([[again.id], [shot.id, clip.id]]);
  });

  it("nobody can attach someone else's upload, or reuse one already sent", async () => {
    const bobs = await upload(bob);
    await expect(submitMyTask(alice, taskId, "Done, see the file", [bobs.id])).rejects.toThrow(DomainError);
    // The failed submit changed nothing.
    expect((await getMyTask(alice, taskId)).status).toBe("PENDING");

    const shot = await upload(alice);
    await submitMyTask(alice, taskId, "Done, see the file", [shot.id]);
    await expect(reviewTask(mia, taskId, "FAIL", "Not quite right", [shot.id])).rejects.toThrow(DomainError);
  });
});

describe("opening files", () => {
  it("only people who can see the task open its files", async () => {
    const shot = await upload(alice);
    await submitMyTask(alice, taskId, "Done, see the file", [shot.id]);

    for (const viewer of [alice, mia, owner]) {
      expect(await findViewableAttachment(viewer, shot.id), viewer.name).not.toBeNull();
    }
    // Another employee, and another team's manager, can't.
    for (const viewer of [bob, noah]) {
      expect(await findViewableAttachment(viewer, shot.id)).toBeNull();
    }
  });

  it("a draft is visible only to whoever uploaded it", async () => {
    const draft = await upload(alice);
    expect(await findViewableAttachment(alice, draft.id)).not.toBeNull();
    expect(await findViewableAttachment(owner, draft.id)).toBeNull();
  });

  it("signs a short-lived link for that one file", async () => {
    const shot = await upload(alice);
    const file = (await findViewableAttachment(alice, shot.id))!;
    const url = await signedFileUrl(file.pathname);
    expect(url).toContain(file.pathname);
    expect(presignUrl).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ operation: "get", pathname: file.pathname }));
    // The read key is reused, not fetched for every file.
    await signedFileUrl(file.pathname);
    expect(issueSignedToken).toHaveBeenCalledTimes(1);
  });

  it("deleting a task removes its files from storage", async () => {
    const shot = await upload(alice);
    await submitMyTask(alice, taskId, "Done, see the file", [shot.id]);
    const { pathname } = (await prisma.attachment.findUniqueOrThrow({ where: { id: shot.id } }));
    await deleteTask(mia, taskId);
    expect(await prisma.attachment.count()).toBe(0);
    expect(stored.has(pathname)).toBe(false);
  });
});
