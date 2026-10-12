"use server";

import { refresh } from "next/cache";
import {
  type ActionResult,
  fieldErrorsOf,
  idSchema,
  reopenSchema,
  taskInputSchema,
  teamSchema,
} from "@/lib/validation";
import { requireAdmin } from "@/server/session";
import * as tasks from "@/server/tasks";
import * as teams from "@/server/teams";
import { DomainError } from "@/server/teams";

/**
 * Admin-only Server Actions. Each one re-checks the session and role itself:
 * these are public POST endpoints, so page-level guards are not enough.
 */

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data } as ActionResult<T>;
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    throw e;
  }
}

// ─── Team ───────────────────────────────────────────────────────────────────

export async function createTeamAction(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = teamSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const res = await run(() => teams.createTeam(admin, parsed.data));
  if (!res.ok) return res;
  refresh();
  return { ok: true };
}

export async function updateTeamAction(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = teamSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const res = await run(() => teams.updateTeam(admin, parsed.data));
  if (!res.ok) return res;
  refresh();
  return { ok: true };
}

export async function searchUsersAction(query: unknown) {
  const admin = await requireAdmin();
  const q = typeof query === "string" ? query.slice(0, 80) : "";
  return teams.searchUsers(admin, q);
}

export async function addMemberAction(userId: unknown): Promise<ActionResult<{ name: string }>> {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(userId);
  if (!id.success) return { ok: false, error: "Invalid user." };
  const res = await run(async () => {
    const user = await teams.addMember(admin, id.data);
    return { name: user.name };
  });
  if (res.ok) refresh();
  return res;
}

export async function removeMemberAction(userId: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(userId);
  if (!id.success) return { ok: false, error: "Invalid user." };
  const res = await run(() => teams.removeMember(admin, id.data));
  if (!res.ok) return res;
  refresh();
  return { ok: true };
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

export async function createTaskAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();
  const parsed = taskInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const res = await run(async () => {
    const task = await tasks.createTask(admin, parsed.data);
    return { id: task.id };
  });
  if (res.ok) refresh();
  return res;
}

export async function updateTaskAction(taskId: unknown, input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(taskId);
  const parsed = taskInputSchema.safeParse(input);
  if (!id.success) return { ok: false, error: "Invalid task." };
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const res = await run(() => tasks.updateTask(admin, id.data, parsed.data));
  if (!res.ok) return res;
  refresh();
  return { ok: true };
}

export async function setTaskArchivedAction(taskId: unknown, archived: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(taskId);
  if (!id.success || typeof archived !== "boolean") return { ok: false, error: "Invalid request." };
  const res = await run(() => tasks.setTaskArchived(admin, id.data, archived));
  if (!res.ok) return res;
  refresh();
  return { ok: true };
}

export async function reopenTaskAction(taskId: unknown, input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(taskId);
  const parsed = reopenSchema.safeParse(input);
  if (!id.success) return { ok: false, error: "Invalid task." };
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const res = await run(() => tasks.reopenTask(admin, id.data, parsed.data.reason));
  if (!res.ok) return res;
  refresh();
  return { ok: true };
}
