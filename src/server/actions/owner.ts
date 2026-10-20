"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { type ActionResult, idSchema, roleChangeSchema } from "@/lib/validation";
import { deleteEmployee, setRole } from "@/server/people";
import { notifyManagerChanged } from "@/server/push";
import { requireOwner } from "@/server/session";
import { deleteTeam, setTeamManager } from "@/server/teams";
import { run } from "./result";

/** Owner-only Server Actions. Each re-checks the role itself. */

export async function setTeamManagerAction(teamId: unknown, userId: unknown): Promise<ActionResult> {
  const owner = await requireOwner();
  const team = idSchema.safeParse(teamId);
  const id = idSchema.safeParse(userId);
  if (!team.success || !id.success) return { ok: false, error: "Invalid request." };
  const res = await run(() => setTeamManager(owner, team.data, id.data));
  if (!res.ok) return res;
  if (res.data) after(() => notifyManagerChanged(team.data, owner));
  refresh();
  return { ok: true };
}

/** Deletes an employee's account (someone who has left). Their record stays, tagged "Deleted". */
export async function deleteEmployeeAction(userId: unknown): Promise<ActionResult<{ name: string; keptTasks: number }>> {
  const owner = await requireOwner();
  const id = idSchema.safeParse(userId);
  if (!id.success) return { ok: false, error: "Invalid person." };
  return run(() => deleteEmployee(owner, id.data));
}

/** Deletes a team; its tasks move to `moveTasksTo` first so nobody's record is lost. */
export async function deleteTeamAction(
  teamId: unknown,
  moveTasksTo: unknown,
): Promise<ActionResult<{ name: string; movedTasks: number; movedTo: string | null }>> {
  const owner = await requireOwner();
  const id = idSchema.safeParse(teamId);
  const target = moveTasksTo === null ? { success: true as const, data: null } : idSchema.safeParse(moveTasksTo);
  if (!id.success || !target.success) return { ok: false, error: "Invalid request." };
  const res = await run(() => deleteTeam(owner, id.data, target.data));
  if (!res.ok) return res;
  const { name, movedTasks, movedTo } = res.data;
  return { ok: true, data: { name, movedTasks, movedTo } };
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
