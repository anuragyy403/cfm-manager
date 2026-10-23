/**
 * Photo and video attachment rules, shared by the upload picker and the
 * server (which re-checks everything: anyone can call an action directly).
 */

export type AttachmentKind = "IMAGE" | "VIDEO" | "FILE";

/** What the viewer needs to show an attachment. The storage path never leaves the server. */
export type AttachmentView = {
  id: string;
  kind: AttachmentKind;
  name: string;
  size: number;
};

/** Per submission, review or message. */
export const MAX_ATTACHMENTS = 6;

/** About 1–2 minutes of phone video. */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

/** Photos are shrunk in the browser first, so this only stops oddities. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Longest side of a photo after the browser shrinks it. */
export const IMAGE_MAX_PX = 2000;

/**
 * Stored types, by file extension. iPhone .mov videos are stored as MP4: it's
 * the same container, and browsers that won't play "video/quicktime" play it.
 */
export const ATTACHMENT_TYPES = {
  jpg: { contentType: "image/jpeg", kind: "IMAGE" },
  png: { contentType: "image/png", kind: "IMAGE" },
  webp: { contentType: "image/webp", kind: "IMAGE" },
  gif: { contentType: "image/gif", kind: "IMAGE" },
  mp4: { contentType: "video/mp4", kind: "VIDEO" },
  webm: { contentType: "video/webm", kind: "VIDEO" },
  pdf: { contentType: "application/pdf", kind: "FILE" },
  txt: { contentType: "text/plain", kind: "FILE" },
  csv: { contentType: "text/csv", kind: "FILE" },
  docx: { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", kind: "FILE" },
  xlsx: { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", kind: "FILE" },
  pptx: { contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", kind: "FILE" },
  zip: { contentType: "application/zip", kind: "FILE" },
} as const satisfies Record<string, { contentType: string; kind: AttachmentKind }>;

export type AttachmentExt = keyof typeof ATTACHMENT_TYPES;

/** The stored extension for a picked file's type, or null when we don't take it. */
export function extForType(type: string): AttachmentExt | null {
  switch (type) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "video/mp4":
    case "video/quicktime":
      return "mp4";
    case "video/webm":
      return "webm";
    case "application/x-zip-compressed":
      return "zip";
    default:
      return (Object.entries(ATTACHMENT_TYPES).find(([, value]) => value.contentType === type)?.[0] as AttachmentExt | undefined) ?? null;
  }
}

export function maxBytesFor(kind: AttachmentKind) {
  return kind === "VIDEO" ? MAX_VIDEO_BYTES : kind === "FILE" ? MAX_FILE_BYTES : MAX_IMAGE_BYTES;
}

/** "1 GB", "4.2 MB", "380 KB". */
export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1).replace(/\.0$/, "")} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
