"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { type ActionResult, completionSchema, fieldErrorsOf, idSchema } from "@/lib/validation";
import { notifyTaskSubmitted } from "@/server/push";
import { requireAssignee } from "@/server/session";
import { startMyTask, submitMyTask } from "@/server/tasks";
import { run } from "./result";

/**
 * Server Actions for working on your own tasks (employees and managers).
 * Someone can only move their own tasks forward; ownership and allowed
 * transitions are enforced in `src/server/tasks.ts`.
 */

export async function startTaskAction(taskId: unknown): Promise<ActionResult> {
  const user = await requireAssignee();
  const id = idSchema.safeParse(taskId);
  if (!id.success) return { ok: false, error: "Invalid task." };
  const res = await run(() => startMyTask(user, id.data));
  if (!res.ok) return res;
  refresh();
  return { ok: true };
}

/** Hands the work in; the reviewer is notified to pass or fail it. */
export async function submitTaskAction(taskId: unknown, input: unknown): Promise<ActionResult> {
  const user = await requireAssignee();
  const id = idSchema.safeParse(taskId);
  const parsed = completionSchema.safeParse(input);
  if (!id.success) return { ok: false, error: "Invalid task." };
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const res = await run(() => submitMyTask(user, id.data, parsed.data.note, parsed.data.attachmentIds));
  if (!res.ok) return res;
  after(() => notifyTaskSubmitted(id.data, user));
  refresh();
  return { ok: true };
}
