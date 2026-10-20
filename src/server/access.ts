import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/server/session";

/**
 * Who can see what. Every query for teams, tasks and people is filtered
 * through these scopes:
 *   - the owner sees every team;
 *   - HR sees every team too, and runs their tasks (but not the teams
 *     themselves: creating teams, moving people and roles stay with the owner);
 *   - a manager sees only the teams they manage;
 *   - an employee sees no team data, only tasks assigned to them.
 */

export class DomainError extends Error {}

export function isOwner(user: CurrentUser) {
  return user.role === "ADMIN";
}

export function isHR(user: CurrentUser) {
  return user.role === "HR";
}

/** The owner and HR work across every team. */
export function seesAllTeams(user: CurrentUser) {
  return isOwner(user) || isHR(user);
}

/** Teams a lead (owner, HR or manager) can see and assign work in. */
export function teamScope(user: CurrentUser): Prisma.TeamWhereInput {
  if (seesAllTeams(user)) return {};
  if (user.role === "MANAGER") return { managerId: user.id };
  // Employees never get team-level access; match nothing.
  return { id: { in: [] } };
}

/**
 * Whether someone may change teams themselves: create them, rename them, and
 * add or remove people. The owner and managers (for their own teams) may; HR
 * works with every team's tasks but leaves the teams to the owner.
 */
export function canChangeTeams(user: CurrentUser) {
  return isOwner(user) || user.role === "MANAGER";
}

/** Tasks a lead can see: everything in their teams. */
export function taskScope(user: CurrentUser): Prisma.TaskWhereInput {
  if (seesAllTeams(user)) return {};
  return { team: teamScope(user) };
}

/**
 * Tasks a lead can open and read (never change): everything in their teams,
 * their own work, and the full record of anyone currently on one of their
 * teams, including work from teams that person was on before.
 */
export function taskReadScope(user: CurrentUser): Prisma.TaskWhereInput {
  if (seesAllTeams(user)) return {};
  if (user.role !== "MANAGER") return { id: { in: [] } };
  return {
    OR: [
      { team: teamScope(user) },
      { assigneeId: user.id },
      { assignee: { memberships: { some: { team: { managerId: user.id } } } } },
    ],
  };
}

/**
 * Tasks someone works on themselves: everything assigned to them that isn't
 * archived, whichever team it was given in. Moving teams, leaving a team or
 * being promoted never hides a person's own work from them.
 */
export function myWorkScope(user: CurrentUser): Prisma.TaskWhereInput {
  return { assigneeId: user.id, archivedAt: null };
}

/** Teams someone is on right now, as an employee or as its manager. */
export function myTeamsWhere(user: CurrentUser): Prisma.TeamWhereInput {
  return { OR: [{ members: { some: { userId: user.id } } }, { managerId: user.id }] };
}

/**
 * Tasks someone can still start or hand in: their own, in a team they are on
 * now. Work from a team they left stays visible but read only; that team's
 * manager can reassign it.
 */
export function myActionScope(user: CurrentUser): Prisma.TaskWhereInput {
  return { ...myWorkScope(user), team: myTeamsWhere(user) };
}

/**
 * Whether a lead may edit, reassign, archive or reopen a task.
 * - The owner may change anything.
 * - HR may change any team's tasks, except ones the owner created.
 * - A manager may change tasks in their own teams, except ones the owner or
 *   HR created: those stay under their control.
 */
export function canManageTask(
  user: CurrentUser,
  task: { team: { managerId: string }; createdBy: { role: string } },
) {
  if (isOwner(user)) return true;
  if (isHR(user)) return task.createdBy.role !== "ADMIN";
  return (
    user.role === "MANAGER" &&
    task.team.managerId === user.id &&
    task.createdBy.role !== "ADMIN" &&
    task.createdBy.role !== "HR"
  );
}

/**
 * Whether someone may pass or fail handed-in work. The team's manager reviews
 * their team's work, except their own (the owner reviews that). The owner and
 * HR may review anything. Nobody reviews work assigned to themselves.
 */
export function canReview(user: CurrentUser, task: { assigneeId: string; team: { managerId: string } }) {
  if (task.assigneeId === user.id) return false;
  if (seesAllTeams(user)) return true;
  return user.role === "MANAGER" && task.team.managerId === user.id;
}

/** Whether a lead may split a task into subtasks (owner, HR, or the team's manager). */
export function canAddSubtask(
  user: CurrentUser,
  task: { parentId: string | null; archivedAt: Date | null; status: string; team: { managerId: string } },
) {
  if (task.parentId || task.archivedAt || task.status === "COMPLETED" || task.status === "SUBMITTED") return false;
  return seesAllTeams(user) || (user.role === "MANAGER" && task.team.managerId === user.id);
}
