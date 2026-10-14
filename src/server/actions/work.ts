"use server";

import { refresh } from "next/cache";
import { type ActionResult, completionSchema, fieldErrorsOf, idSchema } from "@/lib/validation";
import { requireAssignee } from "@/server/session";
import { completeMyTask, startMyTask } from "@/server/tasks";
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

export async function completeTaskAction(taskId: unknown, input: unknown): Promise<ActionResult> {
  const user = await requireAssignee();
  const id = idSchema.safeParse(taskId);
  const parsed = completionSchema.safeParse(input);
  if (!id.success) return { ok: false, error: "Invalid task." };
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const res = await run(() => completeMyTask(user, id.data, parsed.data.note));
  if (!res.ok) return res;
  refresh();
  return { ok: true };
}
