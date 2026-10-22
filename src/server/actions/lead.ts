"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import {
  type ActionResult,
  fieldErrorsOf,
  idSchema,
  reopenSchema,
  reviewSchema,
  taskInputSchema,
  taskUpdateSchema,
  teamSchema,
  teamTaskInputSchema,
} from "@/lib/validation";
import { sendMemberPasswordReset } from "@/server/password-reset";
import { notifyMembershipChanged, notifyTaskAssigned, notifyTaskReopened, notifyTaskReviewed } from "@/server/push";
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
    // No `movedFrom`: they were already on this team, nothing changed.
    const added = "movedFrom" in user;
    return { name: user.name, movedFrom: added ? user.movedFrom : null, fromTeamId: added ? user.movedFromTeamId : null, added };
  });
  if (!res.ok) return res;
  const { name, movedFrom, fromTeamId, added } = res.data;
  if (added) after(() => notifyMembershipChanged({ kind: "added", teamId: team.data, userId: id.data, fromTeamId }, lead));
  refresh();
  return { ok: true, data: { name, movedFrom } };
}

export async function removeMemberAction(teamId: unknown, userId: unknown): Promise<ActionResult> {
  const lead = await requireLead();
  const team = idSchema.safeParse(teamId);
  const id = idSchema.safeParse(userId);
  if (!team.success || !id.success) return { ok: false, error: "Invalid request." };
  const res = await run(() => teams.removeMember(lead, team.data, id.data));
  if (!res.ok) return res;
  after(() => notifyMembershipChanged({ kind: "removed", teamId: team.data, userId: id.data }, lead));
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
  if (res.ok) {
    after(() => notifyTaskAssigned(res.data.id, lead));
    refresh();
  }
  return res;
}

/** Same task to everyone on a team; each employee is notified about their copy. */
export async function createTeamTaskAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  const lead = await requireLead();
  const parsed = teamTaskInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
  const res = await run(() => tasks.createTeamTasks(lead, parsed.data));
  if (!res.ok) return res;
  const ids = res.data;
  after(() => Promise.all(ids.map((id) => notifyTaskAssigned(id, lead))));
  refresh();
  return { ok: true, data: { count: ids.length } };
}

export async function updateTaskAction(taskId: unknown, input: unknown): Promise<ActionResult> {
  const lead = await requireLead();
  const id = idSchema.safeParse(taskId);
  const parsed = taskUpdateSchema.safeParse(input);
  if (!id.success) return { ok: false, error: "Invalid task." };
  if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
  const res = await run(() => tasks.updateTask(lead, id.data, parsed.data));
  if (!res.ok) return res;
  if (res.data.reassigned) after(() => notifyTaskAssigned(res.data.task.id, lead, true));
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

/**
 * Permanently deletes a task with its subtasks and history. Only whoever
 * assigned it may. The page they were on no longer exists, so the client
 * navigates away itself.
 */
export async function deleteTaskAction(taskId: unknown): Promise<ActionResult<{ parentId: string | null }>> {
  const lead = await requireLead();
  const id = idSchema.safeParse(taskId);
  if (!id.success) return { ok: false, error: "Invalid task." };
  return run(() => tasks.deleteTask(lead, id.data));
}

/** Pass or fail handed-in work. The assignee is notified either way. */
export async function reviewTaskAction(taskId: unknown, input: unknown): Promise<ActionResult> {
  const lead = await requireLead();
  const id = idSchema.safeParse(taskId);
  const parsed = reviewSchema.safeParse(input);
  if (!id.success) return { ok: false, error: "Invalid task." };
  if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
  const { decision, note, attachmentIds } = parsed.data;
  const res = await run(() => tasks.reviewTask(lead, id.data, decision, note, attachmentIds));
  if (!res.ok) return res;
  after(() => notifyTaskReviewed(id.data, lead, decision));
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
  after(() => notifyTaskReopened(id.data, lead));
  refresh();
  return { ok: true };
}
