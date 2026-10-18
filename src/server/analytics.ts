import "server-only";
import { startOfWeek, subWeeks, addWeeks } from "date-fns";
import { prisma } from "@/lib/prisma";
import { completedOnTime } from "@/lib/tasks/rules";
import { computeMetrics, type TaskMetrics } from "@/lib/tasks/metrics";
import type { CurrentUser } from "@/server/session";
import { taskScope, teamScope } from "@/server/access";

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

export type TeamAnalytics = {
  /** All tasks in scope together. */
  team: TaskMetrics;
  members: MemberPerformance[];
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
    if (team.manager.role === "MANAGER") {
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

  return {
    team: computeMetrics(tasks, now),
    members,
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
