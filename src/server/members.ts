import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { computeMetrics } from "@/lib/tasks/metrics";
import type { CurrentUser } from "@/server/session";
import { taskListSelect } from "@/server/tasks";
import { getAdminTeam } from "@/server/teams";

/**
 * Everything the admin sees about one person: profile, metrics, tasks and
 * recent activity. Works for current members and for former members who still
 * have tasks on the team.
 */
export async function getMemberOverview(admin: CurrentUser, userId: string) {
  const team = await getAdminTeam(admin);
  if (!team) notFound();

  const [user, membership, tasks] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, username: true, createdAt: true, role: true },
    }),
    prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: team.id, userId } },
      select: { joinedAt: true },
    }),
    prisma.task.findMany({
      where: { teamId: team.id, assigneeId: userId },
      select: taskListSelect,
      orderBy: { dueAt: "desc" },
    }),
  ]);
  if (!user || (!membership && tasks.length === 0)) notFound();

  const activities = await prisma.taskActivity.findMany({
    where: { actorId: userId, task: { teamId: team.id } },
    orderBy: { createdAt: "desc" },
    take: 15,
    include: {
      actor: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    },
  });

  const active = tasks.filter((t) => !t.archivedAt);
  return {
    user,
    joinedAt: membership?.joinedAt ?? null,
    isMember: !!membership,
    tasks: active,
    metrics: computeMetrics(active),
    activities,
  };
}
