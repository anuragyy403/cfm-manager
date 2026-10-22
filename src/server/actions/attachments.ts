"use server";

import { after } from "next/server";
import { z } from "zod";
import type { AttachmentView } from "@/lib/attachments";
import { type ActionResult, idSchema } from "@/lib/validation";
import { cleanUpOldDrafts, createUploadToken, discardDraft, registerUpload } from "@/server/attachments";
import { requireUser } from "@/server/session";
import { run } from "./result";

/**
 * Server Actions behind the photo / video picker. The file itself goes from
 * the browser straight to storage; these only hand out the upload token and
 * record the result. Checks live in `src/server/attachments.ts`.
 */

const fileSchema = z.object({ type: z.string().max(100), size: z.number().int().positive() });
const uploadedSchema = z.object({ pathname: z.string().min(1).max(200), name: z.string().max(300) });

export async function startUploadAction(
  input: unknown,
): Promise<ActionResult<{ pathname: string; token: string; contentType: string }>> {
  const user = await requireUser();
  const parsed = fileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid file." };
  return run(() => createUploadToken(user, parsed.data));
}

export async function finishUploadAction(input: unknown): Promise<ActionResult<AttachmentView>> {
  const user = await requireUser();
  const parsed = uploadedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid upload." };
  const res = await run(() => registerUpload(user, parsed.data.pathname, parsed.data.name));
  after(() => cleanUpOldDrafts());
  return res;
}

export async function discardUploadAction(id: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid file." };
  const res = await run(() => discardDraft(user, parsed.data));
  return res.ok ? { ok: true } : res;
}
