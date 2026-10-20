import "server-only";
import { del, put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { isOurPhotoUrl } from "@/lib/photos";
import { DomainError, isOwner } from "@/server/access";
import type { CurrentUser } from "@/server/session";

/**
 * Profile photos, stored in the public Vercel Blob store (`cfm-photos`).
 * The browser crops and shrinks a photo before upload; the server still
 * checks the size and the actual file bytes, since anyone can call the action.
 */

/** Far above a shrunk photo (~30 KB), far below anything worth abusing. */
export const MAX_PHOTO_BYTES = 512 * 1024;

const FORMATS = [
  { type: "image/jpeg", ext: "jpg", matches: (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    type: "image/png",
    ext: "png",
    matches: (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    type: "image/webp",
    ext: "webp",
    matches: (b: Uint8Array) =>
      String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP",
  },
] as const;

/** Removes an old photo from storage. Best effort: a leftover file is harmless. */
async function deleteStored(url: string | null | undefined) {
  if (url && isOurPhotoUrl(url)) await del(url).catch(() => {});
}

/** Sets the signed-in person's own photo. Returns its URL. */
export async function setMyPhoto(user: CurrentUser, file: File) {
  if (file.size === 0) throw new DomainError("Choose a photo.");
  if (file.size > MAX_PHOTO_BYTES) throw new DomainError("That photo is too large. Try a smaller one.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = FORMATS.find((f) => f.matches(bytes));
  if (!format) throw new DomainError("Use a JPG, PNG or WebP photo.");

  const blob = await put(`avatars/${user.id}.${format.ext}`, Buffer.from(bytes), {
    access: "public",
    // A new name per upload, so browsers never show a stale cached photo.
    addRandomSuffix: true,
    contentType: format.type,
  });
  const previous = await prisma.user.findUnique({ where: { id: user.id }, select: { image: true } });
  await prisma.user.update({ where: { id: user.id }, data: { image: blob.url } });
  await deleteStored(previous?.image);
  return blob.url;
}

/** Removes a photo: your own, or anyone's if you're the owner (e.g. an unsuitable one). */
export async function removePhoto(viewer: CurrentUser, userId: string) {
  if (userId !== viewer.id && !isOwner(viewer)) throw new DomainError("You can only remove your own photo.");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, image: true } });
  if (!user) throw new DomainError("That account no longer exists.");
  if (!user.image) return { name: user.name };
  await prisma.user.update({ where: { id: userId }, data: { image: null } });
  await deleteStored(user.image);
  return { name: user.name };
}
