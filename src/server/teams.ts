import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { computeMetrics } from "@/lib/tasks/metrics";
import { headsTeamAsAssignee } from "@/lib/roles";
import { canChangeTeams, DomainError, isOwner, teamScope } from "@/server/access";
import type { CurrentUser } from "@/server/session";

/**
 * Team data access. Every function takes an already-verified lead (owner, HR
 * or manager) and only touches teams inside that lead's scope. HR can see
 * every team but not change them (see `canChangeTeams`).
 */

const personSelect = { id: true, name: true, email: true, username: true, image: true, role: true } as const;

/** Teams in scope, alphabetically, with their manager and headcount. */
export async function listTeams(viewer: CurrentUser) {
  return prisma.team.findMany({
    where: teamScope(viewer),
    orderBy: { name: "asc" },
    include: {
      manager: { select: personSelect },
      _count: { select: { members: true } },
    },
  });
}

/** Teams in scope with task metrics, for team cards and comparisons. */
export async function listTeamsWithMetrics(viewer: CurrentUser) {
  const [teams, tasks] = await Promise.all([
    listTeams(viewer),
    prisma.task.findMany({
      where: { team: teamScope(viewer), archivedAt: null },
      select: { teamId: true, status: true, dueAt: true, assignedAt: true, startedAt: true, submittedAt: true, completedAt: true, timesFailed: true },
    }),
  ]);
  const now = new Date();
  const byTeam = new Map<string, typeof tasks>();
  for (const t of tasks) byTeam.set(t.teamId, [...(byTeam.get(t.teamId) ?? []), t]);
  return teams.map((team) => ({ ...team, metrics: computeMetrics(byTeam.get(team.id) ?? [], now) }));
}

/** One team in scope, or 404. */
export async function getTeam(viewer: CurrentUser, teamId: string) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, ...teamScope(viewer) },
    include: { manager: { select: personSelect } },
  });
  if (!team) notFound();
  return team;
}

const TEAMS_STAY_WITH_OWNER = "HR can see every team but can't change them. Ask the owner.";

/** A team the viewer may change (rename, people, manager). */
async function requireTeam(viewer: CurrentUser, teamId: string) {
  if (!canChangeTeams(viewer)) throw new DomainError(TEAMS_STAY_WITH_OWNER);
  const team = await prisma.team.findFirst({ where: { id: teamId, ...teamScope(viewer) } });
  if (!team) throw new DomainError("Team not found.");
  return team;
}

/**
 * People the owner can put in charge of a team: managers, HR (for the HR team
 * the owner assigns HR's own work to) and the owner themself.
 */
export async function listManagerCandidates() {
  return prisma.user.findMany({
    where: { role: { in: ["ADMIN", "HR", "MANAGER"] } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, username: true, role: true },
  });
}

async function assertCanManageTeams(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) throw new DomainError("That account no longer exists.");
  if (user.role === "MEMBER") {
    throw new DomainError("Only a manager or HR can run a team. Promote this person first.");
  }
}

/**
 * Creates a team. A manager always becomes the manager of the team they
 * create; the owner chooses who runs it (themself by default).
 */
export async function createTeam(
  viewer: CurrentUser,
  input: { name: string; description: string; managerId?: string },
) {
  if (!canChangeTeams(viewer)) throw new DomainError(TEAMS_STAY_WITH_OWNER);
  let managerId = viewer.id;
  if (isOwner(viewer) && input.managerId) {
    await assertCanManageTeams(input.managerId);
    managerId = input.managerId;
  }
  return prisma.team.create({
    data: { name: input.name, description: input.description || null, managerId },
  });
}

export async function updateTeam(
  viewer: CurrentUser,
  teamId: string,
  input: { name: string; description: string },
) {
  const team = await requireTeam(viewer, teamId);
  return prisma.team.update({
    where: { id: team.id },
    data: { name: input.name, description: input.description || null },
  });
}

/**
 * Owner only: puts someone in charge of a team. Choosing an employee of this
 * team promotes them to manager and takes them off the employee list.
 * Returns null when they already run it.
 */
export async function setTeamManager(owner: CurrentUser, teamId: string, userId: string) {
  if (!isOwner(owner)) throw new DomainError("Only the owner can change a team's manager.");
  const team = await requireTeam(owner, teamId);
  if (team.managerId === userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, memberships: { select: { teamId: true } } },
  });
  if (!user) throw new DomainError("That account no longer exists.");

  if (user.role === "MEMBER") {
    if (!user.memberships.some((m) => m.teamId === teamId)) {
      throw new DomainError("Only an employee of this team can be promoted to its manager here.");
    }
    return prisma.$transaction(async (tx) => {
      await tx.teamMember.deleteMany({ where: { userId } });
      await tx.user.update({ where: { id: userId }, data: { role: "MANAGER" } });
      return tx.team.update({ where: { id: team.id }, data: { managerId: userId } });
    });
  }
  return prisma.team.update({ where: { id: team.id }, data: { managerId: userId } });
}

export async function listTeamMembers(teamId: string) {
  return prisma.teamMember.findMany({
    where: { teamId },
    orderBy: { user: { name: "asc" } },
    select: {
      joinedAt: true,
      user: { select: { id: true, name: true, email: true, username: true, image: true } },
    },
  });
}

export type AssigneeOption = {
  id: string;
  name: string;
  username: string | null;
  /** Open (not completed) tasks already assigned; shown as a workload hint. */
  openTasks: number;
  isManager: boolean;
};

export type TeamOption = { id: string; name: string; people: AssigneeOption[] };

/**
 * Teams in scope with everyone a task can go to: the team's manager (when
 * they are a manager, never the owner) and its employees.
 */
export async function listAssignableTeams(viewer: CurrentUser, onlyTeamId?: string): Promise<TeamOption[]> {
  const teams = await prisma.team.findMany({
    where: { ...teamScope(viewer), ...(onlyTeamId ? { id: onlyTeamId } : {}) },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      manager: { select: { id: true, name: true, username: true, role: true } },
      members: {
        orderBy: { user: { name: "asc" } },
        select: { user: { select: { id: true, name: true, username: true } } },
      },
    },
  });
  const open = await prisma.task.groupBy({
    by: ["assigneeId"],
    where: { archivedAt: null, status: { not: "COMPLETED" } },
    _count: { _all: true },
  });
  const openBy = new Map(open.map((o) => [o.assigneeId, o._count._all]));
  const option = (u: { id: string; name: string; username: string | null }, isManager: boolean) => ({
    ...u,
    openTasks: openBy.get(u.id) ?? 0,
    isManager,
  });

  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    people: [
      // The team's head can be given work: a manager, or HR (by the owner only).
      ...(headsTeamAsAssignee(t.manager.role) && (t.manager.role !== "HR" || isOwner(viewer))
        ? [option(t.manager, true)]
        : []),
      ...t.members.map((m) => option(m.user, false)),
    ],
  }));
}

/** Whether someone can be given work in this team (an employee on it, or its manager). */
export async function isAssignableInTeam(teamId: string, userId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      managerId: true,
      manager: { select: { role: true } },
      members: { where: { userId }, select: { id: true } },
    },
  });
  if (!team) return false;
  if (team.members.length > 0) return true;
  return team.managerId === userId && headsTeamAsAssignee(team.manager.role);
}

export type UserSearchResult = {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
  inTeam: boolean;
  /** The other team this employee is on. Managers only see "another team". */
  otherTeam: string | null;
};

/**
 * Instagram-style lookup of employee accounts by name or username, for adding
 * them to a team. Emails are deliberately not returned.
 */
export async function searchUsers(
  viewer: CurrentUser,
  teamId: string,
  query: string,
): Promise<UserSearchResult[]> {
  const q = query.trim();
  if (q.length < 1) return [];
  await requireTeam(viewer, teamId);

  const users = await prisma.user.findMany({
    where: {
      role: "MEMBER",
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { username: { contains: q.toLowerCase().replace(/^@/, "") } },
      ],
    },
    orderBy: [{ name: "asc" }],
    take: 8,
    select: {
      id: true,
      name: true,
      username: true,
      image: true,
      memberships: { select: { teamId: true, team: { select: { name: true } } } },
    },
  });

  return users.map((u) => {
    const membership = u.memberships[0];
    const inTeam = membership?.teamId === teamId;
    return {
      id: u.id,
      name: u.name,
      username: u.username,
      image: u.image,
      inTeam,
      otherTeam: membership && !inTeam ? (isOwner(viewer) ? membership.team.name : "another team") : null,
    };
  });
}

/**
 * Adds an employee to a team. Each employee is on one team only: a manager
 * can add only people who are not on a team yet; the owner can move someone
 * across from another team.
 */
export async function addMember(viewer: CurrentUser, teamId: string, userId: string) {
  const team = await requireTeam(viewer, teamId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, memberships: { select: { teamId: true, team: { select: { name: true } } } } },
  });
  if (!user) throw new DomainError("That account no longer exists.");
  if (user.role !== "MEMBER") throw new DomainError("Only employees can be added to a team.");

  const current = user.memberships[0];
  if (current?.teamId === team.id) return user;
  if (current && !isOwner(viewer)) {
    throw new DomainError(`${user.name} is already on another team. Ask the owner to move them.`);
  }

  await prisma.$transaction(async (tx) => {
    if (current) await tx.teamMember.deleteMany({ where: { userId } });
    await tx.teamMember.create({ data: { teamId: team.id, userId, addedById: viewer.id } });
  });
  return { ...user, movedFrom: current?.team.name ?? null, movedFromTeamId: current?.teamId ?? null };
}

/**
 * Removes an employee from a team. Their tasks and history are kept; open
 * tasks stay assigned to them until someone reassigns them.
 */
export async function removeMember(viewer: CurrentUser, teamId: string, userId: string) {
  const team = await requireTeam(viewer, teamId);
  const { count } = await prisma.teamMember.deleteMany({ where: { teamId: team.id, userId } });
  if (count === 0) throw new DomainError("That person isn't on this team.");
}

/**
 * The employee's own team as they see it: its name, manager and everyone on
 * it. Only names and usernames are shown to each other, never emails.
 */
export async function getMyTeam(user: CurrentUser) {
  const membership = await prisma.teamMember.findUnique({
    where: { userId: user.id },
    select: {
      joinedAt: true,
      team: {
        select: {
          id: true,
          name: true,
          description: true,
          manager: { select: { id: true, name: true, username: true, role: true } },
          members: {
            orderBy: { user: { name: "asc" } },
            select: { joinedAt: true, user: { select: { id: true, name: true, username: true } } },
          },
        },
      },
    },
  });
  return membership ? { ...membership.team, joinedAt: membership.joinedAt } : null;
}

/**
 * Owner only: deletes a team. Every task given in it (with its history) first
 * moves to `moveTasksToTeamId`, so no one's work record is lost; deleting a
 * team would otherwise delete its tasks. A team with no tasks needs no target.
 * Its employees end up without a team, ready to be added elsewhere.
 */
export async function deleteTeam(owner: CurrentUser, teamId: string, moveTasksToTeamId: string | null) {
  if (!isOwner(owner)) throw new DomainError("Only the owner can delete teams.");
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, _count: { select: { tasks: true, members: true } } },
  });
  if (!team) throw new DomainError("Team not found.");

  const taskCount = team._count.tasks;
  let target: { id: string; name: string } | null = null;
  if (taskCount > 0) {
    if (!moveTasksToTeamId) {
      throw new DomainError(`${team.name} has ${taskCount} task${taskCount === 1 ? "" : "s"}. Choose a team to move them to first.`);
    }
    if (moveTasksToTeamId === team.id) throw new DomainError("Choose a different team to move the tasks to.");
    target = await prisma.team.findUnique({ where: { id: moveTasksToTeamId }, select: { id: true, name: true } });
    if (!target) throw new DomainError("The team to move the tasks to no longer exists.");
  }

  return prisma.$transaction(async (tx) => {
    if (target) await tx.task.updateMany({ where: { teamId: team.id }, data: { teamId: target.id } });
    // Memberships go with the team; the people and their accounts stay.
    await tx.team.delete({ where: { id: team.id } });
    return { name: team.name, movedTasks: taskCount, movedTo: target?.name ?? null, employees: team._count.members };
  });
}

/** What deleting a team involves, for the confirmation dialog. Owner only. */
export async function teamDeletionSummary(owner: CurrentUser, teamId: string) {
  if (!isOwner(owner)) throw new DomainError("Only the owner can delete teams.");
  const [tasks, otherTeams] = await Promise.all([
    prisma.task.count({ where: { teamId } }),
    prisma.team.findMany({ where: { id: { not: teamId } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { tasks, otherTeams };
}
