"use server";

import { refresh } from "next/cache";
import { type ActionResult, completionSchema, fieldErrorsOf, idSchema } from "@/lib/validation";
import { requireMember } from "@/server/session";
import { completeMyTask, startMyTask } from "@/server/tasks";
import { DomainError } from "@/server/teams";

/**
 * Team-member Server Actions. A member can only move their own tasks forward;
 * ownership and allowed transitions are enforced in `src/server/tasks.ts`.
 */

export async function startTaskAction(taskId: unknown): Promise<ActionResult> {
  const member = await requireMember();
  const id = idSchema.safeParse(taskId);
  if (!id.success) return { ok: false, error: "Invalid task." };
  try {
    await startMyTask(member, id.data);
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    throw e;
  }
  refresh();
  return { ok: true };
}

export async function completeTaskAction(taskId: unknown, input: unknown): Promise<ActionResult> {
  const member = await requireMember();
  const id = idSchema.safeParse(taskId);
  const parsed = completionSchema.safeParse(input);
  if (!id.success) return { ok: false, error: "Invalid task." };
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  try {
    await completeMyTask(member, id.data, parsed.data.note);
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    throw e;
  }
  refresh();
  return { ok: true };
}
