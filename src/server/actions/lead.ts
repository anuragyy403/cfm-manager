"use server";

import { refresh } from "next/cache";
import {
  type ActionResult,
  fieldErrorsOf,
  idSchema,
  reopenSchema,
  taskInputSchema,
  taskUpdateSchema,
  teamSchema,
} from "@/lib/validation";
import { sendMemberPasswordReset } from "@/server/password-reset";
import { requireLead } from "@/server/session";
import * as tasks from "@/server/tasks";
import * as teams from "@/server/teams";
import { run } from "./result";

/**
 * Server Actions for leads: the owner and managers. Each one re-checks the
 * session and role itself (these are public POST endpoints), and the data
 * layer limits a manager to their own teams.
 */

const INVALID_FIELDS = "Check the highlighted fields.";

// ─── Teams ──────────────────────────────────────────────────────────────────

export async function createTeamAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const lead = await requireLead();
  const parsed = teamSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
  const res = await run(async () => {
    const team = await teams.createTeam(lead, parsed.data);
    return { id: team.id };
  });
  if (res.ok) refresh();
  return res;
}

export async function updateTeamAction(teamId: unknown, input: unknown): Promise<ActionResult> {
  const lead = await requireLead();
  const id = idSchema.safeParse(teamId);
  const parsed = teamSchema.safeParse(input);
  if (!id.success) return { ok: false, error: "Invalid team." };
  if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
  const res = await run(() => teams.updateTeam(lead, id.data, parsed.data));
  if (!res.ok) return res;
  refresh();
  return { ok: true };
}

export async function searchUsersAction(teamId: unknown, query: unknown) {
  const lead = await requireLead();
  const id = idSchema.safeParse(teamId);
  if (!id.success) return [];
  const q = typeof query === "string" ? query.slice(0, 80) : "";
  const res = await run(() => teams.searchUsers(lead, id.data, q));
  return res.ok ? res.data : [];
}

export async function addMemberAction(
  teamId: unknown,
  userId: unknown,
): Promise<ActionResult<{ name: string; movedFrom: string | null }>> {
  const lead = await requireLead();
  const team = idSchema.safeParse(teamId);
  const id = idSchema.safeParse(userId);
  if (!team.success || !id.success) return { ok: false, error: "Invalid request." };
  const res = await run(async () => {
    const user = await teams.addMember(lead, team.data, id.data);
    return { name: user.name, movedFrom: "movedFrom" in user ? user.movedFrom : null };
  });
  if (res.ok) refresh();
  return res;
}

export async function removeMemberAction(teamId: unknown, userId: unknown): Promise<ActionResult> {
  const lead = await requireLead();
  const team = idSchema.safeParse(teamId);
  const id = idSchema.safeParse(userId);
  if (!team.success || !id.success) return { ok: false, error: "Invalid request." };
  const res = await run(() => teams.removeMember(lead, team.data, id.data));
  if (!res.ok) return res;
  refresh();
  return { ok: true };
}

/** Emails someone a password reset link (for when they're locked out). */
export async function sendPasswordResetAction(userId: unknown): Promise<ActionResult<{ email: string }>> {
  const lead = await requireLead();
  const id = idSchema.safeParse(userId);
  if (!id.success) return { ok: false, error: "Invalid user." };
  return run(async () => {
    const { email } = await sendMemberPasswordReset(lead, id.data);
    return { email };
  });
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

export async function createTaskAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const lead = await requireLead();
  const parsed = taskInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
  const res = await run(async () => {
    const task = await tasks.createTask(lead, parsed.data);
    return { id: task.id };
  });
  if (res.ok) refresh();
  return res;
}

export async function updateTaskAction(taskId: unknown, input: unknown): Promise<ActionResult> {
  const lead = await requireLead();
  const id = idSchema.safeParse(taskId);
  const parsed = taskUpdateSchema.safeParse(input);
  if (!id.success) return { ok: false, error: "Invalid task." };
  if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
  const res = await run(() => tasks.updateTask(lead, id.data, parsed.data));
  if (!res.ok) return res;
  refresh();
  return { ok: true };
}

export async function setTaskArchivedAction(taskId: unknown, archived: unknown): Promise<ActionResult> {
  const lead = await requireLead();
  const id = idSchema.safeParse(taskId);
  if (!id.success || typeof archived !== "boolean") return { ok: false, error: "Invalid request." };
  const res = await run(() => tasks.setTaskArchived(lead, id.data, archived));
  if (!res.ok) return res;
  refresh();
  return { ok: true };
}

export async function reopenTaskAction(taskId: unknown, input: unknown): Promise<ActionResult> {
  const lead = await requireLead();
  const id = idSchema.safeParse(taskId);
  const parsed = reopenSchema.safeParse(input);
  if (!id.success) return { ok: false, error: "Invalid task." };
  if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
  const res = await run(() => tasks.reopenTask(lead, id.data, parsed.data.reason));
  if (!res.ok) return res;
  refresh();
  return { ok: true };
}
