import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/server/session";

/**
 * Who can see what. Every query for teams, tasks and people is filtered
 * through these scopes:
 *   - the owner sees every team;
 *   - a manager sees only the teams they manage;
 *   - an employee sees no team data, only tasks assigned to them.
 */

export class DomainError extends Error {}

export function isOwner(user: CurrentUser) {
  return user.role === "ADMIN";
}

/** Teams a lead (owner or manager) can see and run. */
export function teamScope(user: CurrentUser): Prisma.TeamWhereInput {
  if (isOwner(user)) return {};
  if (user.role === "MANAGER") return { managerId: user.id };
  // Employees never get team-level access; match nothing.
  return { id: { in: [] } };
}

/** Tasks a lead can see: everything in their teams. */
export function taskScope(user: CurrentUser): Prisma.TaskWhereInput {
  if (isOwner(user)) return {};
  return { team: teamScope(user) };
}

/**
 * Tasks someone works on themselves: assigned to them, not archived, in a team
 * they are still part of (as an employee or as its manager).
 */
export function myWorkScope(user: CurrentUser): Prisma.TaskWhereInput {
  return {
    assigneeId: user.id,
    archivedAt: null,
    team: { OR: [{ members: { some: { userId: user.id } } }, { managerId: user.id }] },
  };
}

/**
 * Whether a lead may edit, reassign, archive or reopen a task.
 * The owner may change anything. A manager may change tasks in their own teams,
 * except tasks the owner created: those stay under the owner's control.
 */
export function canManageTask(
  user: CurrentUser,
  task: { team: { managerId: string }; createdBy: { role: string } },
) {
  if (isOwner(user)) return true;
  return user.role === "MANAGER" && task.team.managerId === user.id && task.createdBy.role !== "ADMIN";
}

/** Whether a lead may split a task into subtasks (owner, or the team's manager). */
export function canAddSubtask(
  user: CurrentUser,
  task: { parentId: string | null; archivedAt: Date | null; status: string; team: { managerId: string } },
) {
  if (task.parentId || task.archivedAt || task.status === "COMPLETED") return false;
  return isOwner(user) || (user.role === "MANAGER" && task.team.managerId === user.id);
}
