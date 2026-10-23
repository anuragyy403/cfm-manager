import "server-only";
import { randomBytes } from "node:crypto";
import { del, get, head, issueSignedToken, presignUrl, type IssuedSignedToken } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ATTACHMENT_TYPES,
  type AttachmentExt,
  type AttachmentView,
  extForType,
  formatBytes,
  MAX_ATTACHMENTS,
  maxBytesFor,
} from "@/lib/attachments";
import { DomainError, isOwner, myWorkScope, seesAllTeams, taskReadScope } from "@/server/access";
import type { CurrentUser } from "@/server/session";

/**
 * Photo and video attachments, kept in the private Blob store
 * `cfm-attachments` (its token is ATTACHMENTS_READ_WRITE_TOKEN; the public
 * BLOB_READ_WRITE_TOKEN store is for profile photos only).
 *
 * 1. `createUploadToken` hands the browser a one-off token for one path under
 *    the uploader's own folder, limited by type and size.
 * 2. The browser uploads straight to storage (files are too big for a
 *    Server Action), then `registerUpload` checks the stored file and records
 *    it as a draft.
 * 3. Saving a submission or review links the drafts (`claimDrafts`).
 * 4. `/api/files/[id]` lets people who may see the parent open a file, through
 *    a short-lived signed link.
 */

/** Drafts nobody used are removed after this long. */
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
/** Stops one person filling the store with drafts. */
const MAX_DRAFTS_PER_DAY = 60;
/** Signed links last this long; pages re-sign on every load. */
const LINK_TTL_MS = 60 * 60 * 1000;

export const attachmentViewSelect = { id: true, kind: true, name: true, size: true } satisfies Prisma.AttachmentSelect;

/** Not attached to anything yet. */
const DRAFT = { activityId: null, messageId: null, chatMessageId: null } satisfies Prisma.AttachmentWhereInput;

function storeToken() {
  const token = process.env.ATTACHMENTS_READ_WRITE_TOKEN;
  if (!token) throw new DomainError("File uploads aren't set up on this server yet.");
  return token;
}

/** Local and preview uploads land in their own folders of the same store. */
function folderFor(userId: string) {
  return `${process.env.VERCEL_ENV ?? "local"}/${userId}/`;
}

/**
 * A readable, safe file name for the viewer and downloads (never used as a
 * path), ending in the stored type: a shrunk "screenshot.png" becomes
 * "screenshot.jpg", an iPhone "clip.mov" becomes "clip.mp4".
 */
function cleanName(name: string, ext: AttachmentExt) {
  const base = name
    .replace(/[\u0000-\u001f\u007f/\\"]/g, "")
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .trim()
    .slice(0, 100);
  return `${base || "file"}.${ext}`;
}

// ─── Uploading ──────────────────────────────────────────────────────────────

/** Step 1: a token to upload one file of this type and size to a new path. */
export async function createUploadToken(user: CurrentUser, file: { type: string; size: number }) {
  const ext = extForType(file.type);
  if (!ext) throw new DomainError("Use a photo, MP4/MOV/WebM video, PDF, Office document, TXT, CSV or ZIP file.");
  const { contentType, kind } = ATTACHMENT_TYPES[ext];
  const max = maxBytesFor(kind);
  if (file.size > max) {
    throw new DomainError(
      kind === "VIDEO"
        ? `That video is over ${formatBytes(max)}. Trim it or record a shorter clip.`
        : `That file is over ${formatBytes(max)}.`,
    );
  }
  const recent = await prisma.attachment.count({
    where: { uploaderId: user.id, createdAt: { gte: new Date(Date.now() - DRAFT_TTL_MS) } },
  });
  if (recent >= MAX_DRAFTS_PER_DAY) throw new DomainError("You've uploaded a lot today. Try again tomorrow.");

  const pathname = `${folderFor(user.id)}${randomBytes(16).toString("hex")}.${ext}`;
  const token = await generateClientTokenFromReadWriteToken({
    token: storeToken(),
    pathname,
    allowedContentTypes: [contentType],
    maximumSizeInBytes: max,
    validUntil: Date.now() + 60 * 60 * 1000,
  });
  return { pathname, token, contentType };
}

/** Real file signatures, so a renamed file can't pass as a photo or video. */
function sniff(bytes: Uint8Array): AttachmentExt | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (ascii(0, 4) === "GIF8") return "gif";
  if (ascii(4, 8) === "ftyp") return "mp4";
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "webm";
  return null;
}

async function firstBytes(pathname: string) {
  const res = await get(pathname, {
    access: "private",
    token: storeToken(),
    useCache: false,
    headers: { range: "bytes=0-15" },
  });
  if (!res?.stream) return new Uint8Array();
  const reader = res.stream.getReader();
  const { value } = await reader.read();
  await reader.cancel().catch(() => {});
  return value ?? new Uint8Array();
}

/**
 * Step 2: checks the uploaded file really is what was allowed (right folder,
 * size, signature) and records it as the uploader's draft.
 */
export async function registerUpload(user: CurrentUser, pathname: string, name: string): Promise<AttachmentView> {
  const ext = pathname.split(".").pop() as AttachmentExt;
  if (!pathname.startsWith(folderFor(user.id)) || !(ext in ATTACHMENT_TYPES) || pathname.includes("..")) {
    throw new DomainError("That upload isn't yours.");
  }
  const { kind } = ATTACHMENT_TYPES[ext];
  const meta = await head(pathname, { token: storeToken() }).catch(() => null);
  if (!meta) throw new DomainError("The upload didn't finish. Try again.");

  const bytes = await firstBytes(pathname);
  const signatureMatches = kind === "FILE"
    ? ext === "pdf" ? String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-"
      : ["docx", "xlsx", "pptx", "zip"].includes(ext) ? bytes[0] === 0x50 && bytes[1] === 0x4b
        : !bytes.includes(0) && !sniff(bytes)
    : sniff(bytes) === ext;
  if (meta.size <= 0 || meta.size > maxBytesFor(kind) || !signatureMatches) {
    await del(pathname, { token: storeToken() }).catch(() => {});
    throw new DomainError("The file contents don't match its type, or it exceeds the size limit.");
  }

  return prisma.attachment.create({
    data: {
      uploaderId: user.id,
      kind,
      name: cleanName(name, ext),
      contentType: ATTACHMENT_TYPES[ext].contentType,
      size: meta.size,
      pathname,
    },
    select: attachmentViewSelect,
  });
}

/** Removes one of your own drafts (taken off before sending). */
export async function discardDraft(user: CurrentUser, id: string) {
  const draft = await prisma.attachment.findFirst({
    where: { id, uploaderId: user.id, ...DRAFT },
    select: { id: true, pathname: true },
  });
  if (!draft) return;
  await prisma.attachment.delete({ where: { id: draft.id } });
  await deleteStoredFiles([draft.pathname]);
}

/**
 * Step 3, inside the transaction that saves a submission, review or message:
 * links the uploader's own unused drafts to it.
 */
export async function claimDrafts(
  tx: Prisma.TransactionClient,
  user: CurrentUser,
  ids: string[],
  target: { activityId: string } | { messageId: string } | { chatMessageId: string },
) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  if (unique.length > MAX_ATTACHMENTS) throw new DomainError(`Attach up to ${MAX_ATTACHMENTS} files.`);
  const { count } = await tx.attachment.updateMany({
    where: { id: { in: unique }, uploaderId: user.id, ...DRAFT, ...("chatMessageId" in target ? {} : { kind: { in: ["IMAGE", "VIDEO"] } }) },
    data: target,
  });
  if (count !== unique.length) {
    throw new DomainError("Some files couldn't be attached. Remove them, add them again and resend.");
  }
}

/** Best effort: a leftover file only costs storage. */
export async function deleteStoredFiles(pathnames: string[]) {
  if (pathnames.length === 0) return;
  await del(pathnames, { token: storeToken() }).catch(() => {});
}

/** Drafts older than a day that nobody sent. Runs after uploads, a batch at a time. */
export async function cleanUpOldDrafts() {
  const old = await prisma.attachment.findMany({
    where: { ...DRAFT, createdAt: { lt: new Date(Date.now() - DRAFT_TTL_MS) } },
    select: { id: true, pathname: true },
    take: 50,
  });
  if (old.length === 0) return;
  await deleteStoredFiles(old.map((a) => a.pathname));
  await prisma.attachment.deleteMany({ where: { id: { in: old.map((a) => a.id) }, ...DRAFT } });
}

// ─── Viewing ────────────────────────────────────────────────────────────────

/**
 * An attachment the viewer may open: their own draft, one on a task they can
 * see (as its assignee, or as a lead who can read it), or one in a private
 * conversation they're part of. Null otherwise.
 */
export async function findViewableAttachment(viewer: CurrentUser, id: string) {
  // The owner and HR read every task, and the owner every conversation. Their
  // scopes are `{}`, which inside an OR would match nothing, so they get their own branch.
  const onVisibleTask: Prisma.AttachmentWhereInput = seesAllTeams(viewer)
    ? { activityId: { not: null } }
    : { activity: { task: { OR: [myWorkScope(viewer), taskReadScope(viewer)] } } };
  const inVisibleConversation: Prisma.AttachmentWhereInput = isOwner(viewer)
    ? { messageId: { not: null } }
    : { message: { conversation: { creatorId: viewer.id } } };
  return prisma.attachment.findFirst({
    where: {
      id,
      OR: [
        { uploaderId: viewer.id, ...DRAFT }, onVisibleTask, inVisibleConversation,
        { chatMessage: { deletedAt: null, chat: { OR: [{ firstId: viewer.id }, { secondId: viewer.id }] } } },
      ],
    },
    select: { pathname: true, name: true, contentType: true },
  });
}

let readKey: IssuedSignedToken | null = null;

/**
 * A read-only signing key for the store, kept on the server and reused until
 * near its expiry. Each link signed with it works for one path only.
 */
async function signingKey() {
  if (!readKey || readKey.validUntil - Date.now() < LINK_TTL_MS + 5 * 60 * 1000) {
    readKey = await issueSignedToken({
      token: storeToken(),
      pathname: "*",
      operations: ["get"],
      validUntil: Date.now() + 3 * LINK_TTL_MS,
    });
  }
  return readKey;
}

/** The stored file itself, for downloads under its own name. */
export function readStoredFile(pathname: string) {
  return get(pathname, { access: "private", token: storeToken() });
}

/** A short-lived link to one stored file. */
export async function signedFileUrl(pathname: string) {
  const { presignedUrl } = await presignUrl(await signingKey(), {
    access: "private",
    operation: "get",
    pathname,
    validUntil: Date.now() + LINK_TTL_MS,
  });
  return presignedUrl;
}
