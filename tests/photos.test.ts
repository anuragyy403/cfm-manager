/**
 * Profile photos: only real image files are stored, people change only their
 * own photo (the owner may remove anyone's), and only photos from our own
 * store are ever shown. Vercel Blob is mocked; nothing is uploaded.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/generated/prisma/client";
import type { CurrentUser } from "@/server/session";

const BLOB = "https://abc123.public.blob.vercel-storage.com";
const put = vi.fn(async (pathname: string) => ({ url: `${BLOB}/${pathname.replace(/\.(\w+)$/, `-${randomUUID().slice(0, 6)}.$1`)}` }));
const del = vi.fn(async () => {});
vi.mock("@vercel/blob", () => ({ put, del }));

const { prisma } = await import("@/lib/prisma");
const { auth } = await import("@/lib/auth");
const { isOurPhotoUrl } = await import("@/lib/photos");
const { DomainError } = await import("@/server/access");
const { MAX_PHOTO_BYTES, removePhoto, setMyPhoto } = await import("@/server/photos");

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const photo = (bytes: Uint8Array, type = "image/jpeg") => new File([bytes as BlobPart], "photo", { type });

async function makeUser(name: string, role: Role): Promise<CurrentUser> {
  const username = `${name.toLowerCase().replace(/\s+/g, "")}${randomUUID().slice(0, 6)}`;
  return prisma.user.create({
    data: { id: randomUUID(), name, email: `${username}@test.local`, username, role },
    select: { id: true, name: true, email: true, username: true, image: true, role: true },
  });
}

async function wipe() {
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
}

const imageOf = async (id: string) => (await prisma.user.findUniqueOrThrow({ where: { id } })).image;

let owner: CurrentUser;
let alice: CurrentUser;
let bob: CurrentUser;

beforeEach(async () => {
  await wipe();
  put.mockClear();
  del.mockClear();
  owner = await makeUser("Olivia Owner", "ADMIN");
  alice = await makeUser("Alice Member", "MEMBER");
  bob = await makeUser("Bob Member", "MEMBER");
});

afterAll(wipe);

describe("profile photos", () => {
  it("stores a real photo and replaces the old one", async () => {
    const first = await setMyPhoto(alice, photo(JPEG));
    expect(await imageOf(alice.id)).toBe(first);
    expect(put).toHaveBeenLastCalledWith(`avatars/${alice.id}.jpg`, expect.any(Buffer), expect.objectContaining({ access: "public", contentType: "image/jpeg" }));

    const second = await setMyPhoto(alice, photo(PNG, "image/png"));
    expect(await imageOf(alice.id)).toBe(second);
    expect(del).toHaveBeenCalledWith(first); // the old file is cleaned up
  });

  it("rejects files that aren't images, whatever they claim to be, and oversized ones", async () => {
    const fake = new TextEncoder().encode("<svg onload=alert(1)>");
    await expect(setMyPhoto(alice, photo(fake, "image/jpeg"))).rejects.toThrow(DomainError);
    await expect(setMyPhoto(alice, photo(new Uint8Array()))).rejects.toThrow(DomainError);
    const huge = new Uint8Array(MAX_PHOTO_BYTES + 1);
    huge.set(JPEG);
    await expect(setMyPhoto(alice, photo(huge))).rejects.toThrow(DomainError);
    expect(put).not.toHaveBeenCalled();
    expect(await imageOf(alice.id)).toBeNull();
  });

  it("people remove only their own photo; the owner can remove anyone's", async () => {
    await setMyPhoto(alice, photo(JPEG));
    await expect(removePhoto(bob, alice.id)).rejects.toThrow(DomainError);
    expect(await imageOf(alice.id)).not.toBeNull();

    await removePhoto(owner, alice.id);
    expect(await imageOf(alice.id)).toBeNull();

    await setMyPhoto(bob, photo(JPEG));
    await removePhoto(bob, bob.id);
    expect(await imageOf(bob.id)).toBeNull();
  });

  it("can't be set to an outside address through the sign-in system", async () => {
    const res = await auth.api.signUpEmail({
      body: { name: "Kabir", email: "kabir@test.local", password: "a-good-password-1", username: "kabir1", image: "https://evil.example/pixel.png" },
    });
    expect(await imageOf(res.user.id)).toBeNull();
  });

  it("only shows photos from our own store", () => {
    expect(isOurPhotoUrl(`${BLOB}/avatars/x.jpg`)).toBe(true);
    expect(isOurPhotoUrl("https://evil.example/pixel.png")).toBe(false);
    expect(isOurPhotoUrl("http://abc.public.blob.vercel-storage.com/x.jpg")).toBe(false);
    expect(isOurPhotoUrl("https://public.blob.vercel-storage.com.evil.example/x.jpg")).toBe(false);
    expect(isOurPhotoUrl(null)).toBe(false);
  });
});
