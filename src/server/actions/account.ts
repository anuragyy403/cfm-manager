"use server";

import { refresh } from "next/cache";
import { type ActionResult, idSchema } from "@/lib/validation";
import { removePhoto, setMyPhoto } from "@/server/photos";
import { requireUser } from "@/server/session";
import { run } from "./result";

/** Server Actions for your own account. Each re-checks the session itself. */

/** Uploads a new profile photo for the signed-in person (form field `photo`). */
export async function setMyPhotoAction(form: FormData): Promise<ActionResult<{ url: string }>> {
  const user = await requireUser();
  const file = form.get("photo");
  if (!(file instanceof File)) return { ok: false, error: "Choose a photo." };
  const res = await run(async () => ({ url: await setMyPhoto(user, file) }));
  if (res.ok) refresh();
  return res;
}

/** Removes a photo: your own, or (owner only) someone else's. */
export async function removePhotoAction(userId: unknown): Promise<ActionResult<{ name: string }>> {
  const user = await requireUser();
  const id = idSchema.safeParse(userId);
  if (!id.success) return { ok: false, error: "Invalid person." };
  const res = await run(() => removePhoto(user, id.data));
  if (res.ok) refresh();
  return res;
}
