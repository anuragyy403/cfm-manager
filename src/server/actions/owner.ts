"use server";

import { refresh } from "next/cache";
import { type ActionResult, idSchema, roleChangeSchema } from "@/lib/validation";
import { setRole } from "@/server/people";
import { requireOwner } from "@/server/session";
import { deleteTask } from "@/server/tasks";
import { setTeamManager } from "@/server/teams";
import { run } from "./result";

/** Owner-only Server Actions. Each re-checks the role itself. */

export async function setTeamManagerAction(teamId: unknown, userId: unknown): Promise<ActionResult> {
  const owner = await requireOwner();
  const team = idSchema.safeParse(teamId);
  const id = idSchema.safeParse(userId);
  if (!team.success || !id.success) return { ok: false, error: "Invalid request." };
  const res = await run(() => setTeamManager(owner, team.data, id.data));
  if (!res.ok) return res;
  refresh();
  return { ok: true };
}

/**
 * Permanently deletes a task with its subtasks and history. The page the
 * owner was on no longer exists, so the client navigates away itself.
 */
export async function deleteTaskAction(taskId: unknown): Promise<ActionResult<{ parentId: string | null }>> {
  const owner = await requireOwner();
  const id = idSchema.safeParse(taskId);
  if (!id.success) return { ok: false, error: "Invalid task." };
  return run(() => deleteTask(owner, id.data));
}

export async function setRoleAction(userId: unknown, role: unknown): Promise<ActionResult> {
  const owner = await requireOwner();
  const id = idSchema.safeParse(userId);
  const next = roleChangeSchema.safeParse(role);
  if (!id.success || !next.success) return { ok: false, error: "Invalid request." };
  const res = await run(() => setRole(owner, id.data, next.data));
  if (!res.ok) return res;
  refresh();
  return { ok: true };
}
