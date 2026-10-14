import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { computeMetrics } from "@/lib/tasks/metrics";
import { DomainError, isOwner, taskScope } from "@/server/access";
import type { CurrentUser } from "@/server/session";
import { taskListSelect } from "@/server/tasks";

/** Everyone in the company with their role, team and task metrics (owner only). */
export async function listPeople(owner: CurrentUser) {
  if (!isOwner(owner)) throw new DomainError("Only the owner can see everyone.");
  const [users, tasks] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
        memberships: { select: { team: { select: { id: true, name: true } } } },
        managedTeams: { orderBy: { name: "asc" }, select: { id: true, name: true } },
      },
    }),
    prisma.task.findMany({
      where: { archivedAt: null },
      select: { assigneeId: true, status: true, dueAt: true, assignedAt: true, startedAt: true, completedAt: true },
    }),
  ]);
  const now = new Date();
  const byAssignee = new Map<string, typeof tasks>();
  for (const t of tasks) byAssignee.set(t.assigneeId, [...(byAssignee.get(t.assigneeId) ?? []), t]);
  return users.map(({ memberships, ...u }) => ({
    ...u,
    team: memberships[0]?.team ?? null,
    metrics: computeMetrics(byAssignee.get(u.id) ?? [], now),
  }));
}

/**
 * Everything a lead may see about one person: profile, team, metrics, tasks
 * and recent activity. The owner sees anyone; a manager sees people on their
 * teams (and former members who still have tasks there), limited to the
 * manager's own teams.
 */
export async function getPersonOverview(viewer: CurrentUser, userId: string) {
  const scope = taskScope(viewer);
  const [user, tasks] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        createdAt: true,
        role: true,
        memberships: { select: { joinedAt: true, team: { select: { id: true, name: true, managerId: true } } } },
        managedTeams: { orderBy: { name: "asc" }, select: { id: true, name: true } },
      },
    }),
    prisma.task.findMany({
      where: { ...scope, assigneeId: userId },
      select: taskListSelect,
      orderBy: { dueAt: "desc" },
    }),
  ]);
  if (!user) notFound();

  const membership = user.memberships[0] ?? null;
  const onViewersTeam = isOwner(viewer) || membership?.team.managerId === viewer.id;
  if (!isOwner(viewer) && !onViewersTeam && tasks.length === 0) notFound();
  // Managers never get to open another lead's profile.
  if (!isOwner(viewer) && user.role !== "MEMBER") notFound();

  const activities = await prisma.taskActivity.findMany({
    where: { actorId: userId, task: scope },
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
    team: membership ? { id: membership.team.id, name: membership.team.name } : null,
    joinedAt: membership?.joinedAt ?? null,
    /** For a manager: whether this person is currently on one of their teams. */
    onViewersTeam,
    tasks: active,
    metrics: computeMetrics(active),
    activities,
  };
}

/**
 * Owner only: promote an employee to manager, or make a manager an employee
 * again. Promoting takes the person off their team's employee list (their
 * tasks and history stay). A manager still running a team must hand it over
 * before becoming an employee.
 */
export async function setRole(owner: CurrentUser, userId: string, role: "MANAGER" | "MEMBER") {
  if (!isOwner(owner)) throw new DomainError("Only the owner can change roles.");
  if (userId === owner.id) throw new DomainError("You can't change your own role.");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, managedTeams: { select: { name: true } } },
  });
  if (!user) throw new DomainError("That account no longer exists.");
  if (user.role === "ADMIN") throw new DomainError("The owner's role can't be changed here.");
  if (user.role === role) return user;

  if (role === "MEMBER" && user.managedTeams.length > 0) {
    const names = user.managedTeams.map((t) => t.name).join(", ");
    throw new DomainError(`${user.name} still runs ${names}. Give the team a new manager first.`);
  }

  await prisma.$transaction(async (tx) => {
    if (role === "MANAGER") await tx.teamMember.deleteMany({ where: { userId } });
    await tx.user.update({ where: { id: userId }, data: { role } });
  });
  return user;
}
