import "server-only";
import { startOfWeek, subWeeks, addWeeks } from "date-fns";
import { prisma } from "@/lib/prisma";
import { completedOnTime } from "@/lib/tasks/rules";
import { computeMetrics, type TaskMetrics } from "@/lib/tasks/metrics";
import type { CurrentUser } from "@/server/session";
import { getAdminTeam, listTeamMembers } from "@/server/teams";

export type MemberPerformance = {
  user: { id: string; name: string; username: string | null; email: string };
  joinedAt: Date;
  metrics: TaskMetrics;
};

export type TeamAnalytics = {
  team: TaskMetrics;
  members: MemberPerformance[];
};

/**
 * Metrics for the admin's team and each current member.
 * `since` limits the set to tasks assigned on or after that date.
 */
export async function getTeamAnalytics(
  admin: CurrentUser,
  since?: Date,
): Promise<TeamAnalytics | null> {
  const team = await getAdminTeam(admin);
  if (!team) return null;

  const [members, tasks] = await Promise.all([
    listTeamMembers(team.id),
    prisma.task.findMany({
      where: {
        teamId: team.id,
        archivedAt: null,
        ...(since ? { assignedAt: { gte: since } } : {}),
      },
      select: {
        assigneeId: true,
        status: true,
        dueAt: true,
        assignedAt: true,
        startedAt: true,
        completedAt: true,
      },
    }),
  ]);

  const now = new Date();
  const byAssignee = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const list = byAssignee.get(t.assigneeId) ?? [];
    list.push(t);
    byAssignee.set(t.assigneeId, list);
  }

  return {
    team: computeMetrics(tasks, now),
    members: members.map((m) => ({
      user: m.user,
      joinedAt: m.joinedAt,
      metrics: computeMetrics(byAssignee.get(m.user.id) ?? [], now),
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
export async function getWeeklyTrend(admin: CurrentUser, weeks = 8): Promise<WeeklyPoint[]> {
  const team = await getAdminTeam(admin);
  if (!team) return [];
  const firstWeek = startOfWeek(subWeeks(new Date(), weeks - 1), { weekStartsOn: 1 });

  const tasks = await prisma.task.findMany({
    where: {
      teamId: team.id,
      archivedAt: null,
      OR: [{ assignedAt: { gte: firstWeek } }, { completedAt: { gte: firstWeek } }],
    },
    select: { assignedAt: true, completedAt: true, dueAt: true },
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
