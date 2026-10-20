import "server-only";
import { startOfWeek, subWeeks, addWeeks } from "date-fns";
import { prisma } from "@/lib/prisma";
import { headsTeamAsAssignee } from "@/lib/roles";
import { completedOnTime } from "@/lib/tasks/rules";
import { computeMetrics, type TaskMetrics } from "@/lib/tasks/metrics";
import type { Role } from "@/generated/prisma/client";
import type { CurrentUser } from "@/server/session";
import { seesAllTeams, taskScope, teamScope } from "@/server/access";

export type MemberPerformance = {
  user: { id: string; name: string; username: string | null; email: string };
  /** Manager of the team, or an employee on it. */
  isManager: boolean;
  team: { id: string; name: string };
  joinedAt: Date | null;
  metrics: TaskMetrics;
};

export type TeamPerformance = {
  id: string;
  name: string;
  manager: { id: string; name: string };
  memberCount: number;
  metrics: TaskMetrics;
};

/**
 * One person's overall record: every task they were given in the teams in
 * scope, whichever team they're on now. Moving someone to another team never
 * hides the work they did before.
 */
export type PersonPerformance = {
  user: { id: string; name: string; username: string | null; email: string };
  role: Role;
  /** The owner deleted their account; the record is kept. */
  deleted: boolean;
  /** Teams in scope they're on now (as employee or manager); empty if they've left. */
  currentTeams: string[];
  metrics: TaskMetrics;
};

export type TeamAnalytics = {
  /** All tasks in scope together. */
  team: TaskMetrics;
  /** Per team: its current manager and employees (for team views). */
  members: MemberPerformance[];
  /** Per person, across teams (for people performance). */
  people: PersonPerformance[];
  teams: TeamPerformance[];
};

/**
 * Metrics for the lead's teams (or one of them), each team, and everyone who
 * gets work in them: employees and their managers. `since` limits the set to
 * tasks assigned on or after that date. Null when the lead has no team yet.
 */
export async function getTeamAnalytics(
  viewer: CurrentUser,
  { since, teamId }: { since?: Date; teamId?: string } = {},
): Promise<TeamAnalytics | null> {
  const teams = await prisma.team.findMany({
    where: { ...teamScope(viewer), ...(teamId ? { id: teamId } : {}) },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      manager: { select: { id: true, name: true, username: true, email: true, role: true } },
      members: {
        orderBy: { user: { name: "asc" } },
        select: { joinedAt: true, user: { select: { id: true, name: true, username: true, email: true } } },
      },
    },
  });
  if (teams.length === 0) return null;

  const tasks = await prisma.task.findMany({
    where: {
      teamId: { in: teams.map((t) => t.id) },
      archivedAt: null,
      ...(since ? { assignedAt: { gte: since } } : {}),
    },
    select: {
      teamId: true,
      assigneeId: true,
      status: true,
      dueAt: true,
      assignedAt: true,
      startedAt: true,
      submittedAt: true,
      completedAt: true,
      timesFailed: true,
    },
  });

  const now = new Date();
  const key = (teamId: string, userId: string) => `${teamId}:${userId}`;
  const byPerson = new Map<string, typeof tasks>();
  const byTeam = new Map<string, typeof tasks>();
  for (const t of tasks) {
    byPerson.set(key(t.teamId, t.assigneeId), [...(byPerson.get(key(t.teamId, t.assigneeId)) ?? []), t]);
    byTeam.set(t.teamId, [...(byTeam.get(t.teamId) ?? []), t]);
  }

  const members: MemberPerformance[] = [];
  for (const team of teams) {
    const ref = { id: team.id, name: team.name };
    if (headsTeamAsAssignee(team.manager.role)) {
      const { id, name, username, email } = team.manager;
      const user = { id, name, username, email };
      members.push({
        user,
        isManager: true,
        team: ref,
        joinedAt: null,
        metrics: computeMetrics(byPerson.get(key(team.id, user.id)) ?? [], now),
      });
    }
    for (const m of team.members) {
      members.push({
        user: m.user,
        isManager: false,
        team: ref,
        joinedAt: m.joinedAt,
        metrics: computeMetrics(byPerson.get(key(team.id, m.user.id)) ?? [], now),
      });
    }
  }

  // Everyone with work in scope (current or former members), plus current
  // members who have none yet. The owner is never assigned work.
  const byAssignee = new Map<string, typeof tasks>();
  for (const t of tasks) byAssignee.set(t.assigneeId, [...(byAssignee.get(t.assigneeId) ?? []), t]);
  const personIds = new Set(byAssignee.keys());
  for (const team of teams) {
    if (headsTeamAsAssignee(team.manager.role)) personIds.add(team.manager.id);
    for (const m of team.members) personIds.add(m.user.id);
  }
  // Company-wide (owner and HR, no team filter): everyone is listed, HR
  // included, even people who aren't on a team or have no work yet. Deleted
  // accounts only show when they have work on record (added above).
  if (seesAllTeams(viewer) && !teamId) {
    const everyone = await prisma.user.findMany({ where: { role: { not: "ADMIN" }, deletedAt: null }, select: { id: true } });
    for (const u of everyone) personIds.add(u.id);
  }
  const currentTeams = new Map<string, string[]>();
  for (const team of teams) {
    for (const id of [team.manager.id, ...team.members.map((m) => m.user.id)]) {
      currentTeams.set(id, [...(currentTeams.get(id) ?? []), team.name]);
    }
  }
  const users = await prisma.user.findMany({
    where: { id: { in: [...personIds] }, role: { not: "ADMIN" } },
    select: { id: true, name: true, username: true, email: true, role: true, deletedAt: true },
  });
  const people: PersonPerformance[] = users
    .map(({ role, deletedAt, ...user }) => ({
      user,
      role,
      deleted: !!deletedAt,
      currentTeams: currentTeams.get(user.id) ?? [],
      metrics: computeMetrics(byAssignee.get(user.id) ?? [], now),
    }))
    .sort((a, b) => b.metrics.total - a.metrics.total || a.user.name.localeCompare(b.user.name));

  return {
    team: computeMetrics(tasks, now),
    members,
    people,
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      manager: { id: t.manager.id, name: t.manager.name },
      memberCount: t.members.length,
      metrics: computeMetrics(byTeam.get(t.id) ?? [], now),
    })),
  };
}

export type WeeklyPoint = {
  weekStart: Date;
  assigned: number;
  completed: number;
  completedOnTime: number;
};

/** Tasks assigned vs completed per week for the last `weeks` weeks (Mon–Sun). */
export async function getWeeklyTrend(
  viewer: CurrentUser,
  { weeks = 8, teamId }: { weeks?: number; teamId?: string } = {},
): Promise<WeeklyPoint[]> {
  const firstWeek = startOfWeek(subWeeks(new Date(), weeks - 1), { weekStartsOn: 1 });

  const tasks = await prisma.task.findMany({
    where: {
      ...taskScope(viewer),
      ...(teamId ? { teamId } : {}),
      archivedAt: null,
      OR: [{ assignedAt: { gte: firstWeek } }, { completedAt: { gte: firstWeek } }],
    },
    select: { assignedAt: true, submittedAt: true, completedAt: true, dueAt: true },
  });

  const points: WeeklyPoint[] = Array.from({ length: weeks }, (_, i) => ({
    weekStart: addWeeks(firstWeek, i),
    assigned: 0,
    completed: 0,
    completedOnTime: 0,
  }));
  const indexOf = (d: Date) =>
    // Round (not floor): a DST change can make a week an hour shorter or longer.
    Math.round((startOfWeek(d, { weekStartsOn: 1 }).getTime() - firstWeek.getTime()) / (7 * 864e5));

  for (const t of tasks) {
    const a = indexOf(t.assignedAt);
    if (a >= 0 && a < weeks) points[a]!.assigned++;
    if (t.completedAt) {
      const c = indexOf(t.completedAt);
      if (c >= 0 && c < weeks) {
        points[c]!.completed++;
        if (completedOnTime(t)) points[c]!.completedOnTime++;
      }
    }
  }
  return points;
}
