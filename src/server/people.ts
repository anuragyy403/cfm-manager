import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { computeMetrics } from "@/lib/tasks/metrics";
import { DomainError, isOwner, seesAllTeams, taskReadScope } from "@/server/access";
import type { CurrentUser } from "@/server/session";
import { taskListSelect } from "@/server/tasks";

/** Everyone in the company with their role, team and task metrics, deleted accounts included (owner only). */
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
        image: true,
        createdAt: true,
        deletedAt: true,
        memberships: { select: { team: { select: { id: true, name: true } } } },
        managedTeams: { orderBy: { name: "asc" }, select: { id: true, name: true } },
      },
    }),
    prisma.task.findMany({
      where: { archivedAt: null },
      select: { assigneeId: true, status: true, dueAt: true, assignedAt: true, startedAt: true, submittedAt: true, completedAt: true, timesFailed: true },
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
 * and recent activity. The owner sees anyone. A manager sees the whole record
 * of people now on their teams (work from earlier teams included), and only
 * the work done on their teams for former members.
 */
export async function getPersonOverview(viewer: CurrentUser, userId: string) {
  const scope = taskReadScope(viewer);
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
        image: true,
        deletedAt: true,
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
  const everyone = seesAllTeams(viewer);
  const onViewersTeam = everyone || membership?.team.managerId === viewer.id;
  if (!everyone && !onViewersTeam && tasks.length === 0) notFound();
  // Managers never get to open another lead's profile; the owner and HR see everyone but the owner.
  if (!everyone && user.role !== "MEMBER") notFound();
  if (user.role === "ADMIN" && !isOwner(viewer)) notFound();

  const activities = await prisma.taskActivity.findMany({
    where: { actorId: userId, task: scope },
    orderBy: { createdAt: "desc" },
    take: 15,
    include: {
      actor: { select: { id: true, name: true, image: true } },
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
 * Owner only: make someone an employee, a manager or HR. Becoming a manager
 * or HR takes the person off their team's employee list (their tasks and
 * history stay). Someone still heading a team must hand it over before
 * becoming an employee.
 */
export async function setRole(owner: CurrentUser, userId: string, role: "HR" | "MANAGER" | "MEMBER") {
  if (!isOwner(owner)) throw new DomainError("Only the owner can change roles.");
  if (userId === owner.id) throw new DomainError("You can't change your own role.");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, deletedAt: true, managedTeams: { select: { name: true } } },
  });
  if (!user) throw new DomainError("That account no longer exists.");
  if (user.deletedAt) throw new DomainError(`${user.name}'s account is deleted.`);
  if (user.role === "ADMIN") throw new DomainError("The owner's role can't be changed here.");
  if (user.role === role) return user;

  if (role === "MEMBER" && user.managedTeams.length > 0) {
    const names = user.managedTeams.map((t) => t.name).join(", ");
    throw new DomainError(`${user.name} still runs ${names}. Give the team a new head first.`);
  }

  await prisma.$transaction(async (tx) => {
    // Leads (managers and HR) aren't on an employee list.
    if (role !== "MEMBER") await tx.teamMember.deleteMany({ where: { userId } });
    await tx.user.update({ where: { id: userId }, data: { role } });
  });
  return user;
}

/** What deleting an employee would remove, for the confirmation dialog. Owner only. */
export async function employeeDeletionSummary(owner: CurrentUser, userId: string) {
  if (!isOwner(owner)) throw new DomainError("Only the owner can delete accounts.");
  const [tasks, open] = await Promise.all([
    prisma.task.count({ where: { assigneeId: userId } }),
    prisma.task.count({ where: { assigneeId: userId, archivedAt: null, status: { in: ["PENDING", "IN_PROGRESS", "SUBMITTED"] } } }),
  ]);
  return { tasks, open };
}

/**
 * Owner only: deletes an employee's account, e.g. someone who has left the
 * company. They are signed out everywhere, can't sign in again and come off
 * their team, but their record stays: every task, review and history entry is
 * kept and shown with a "Deleted" tag. Open work can be reassigned by a lead.
 *
 * Only employees: a manager or HR is changed to employee first.
 */
export async function deleteEmployee(owner: CurrentUser, userId: string) {
  if (!isOwner(owner)) throw new DomainError("Only the owner can delete accounts.");
  if (userId === owner.id) throw new DomainError("You can't delete your own account.");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, deletedAt: true },
  });
  if (!user) throw new DomainError("That account no longer exists.");
  if (user.deletedAt) throw new DomainError(`${user.name}'s account is already deleted.`);
  if (user.role !== "MEMBER") {
    throw new DomainError(`${user.name} isn't an employee. Change their role to employee first, then delete the account.`);
  }

  return prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { deletedAt: new Date() } });
    // Signed out everywhere, off their team and no more phone notifications.
    // Sign-in stays blocked by `deletedAt` (see src/lib/auth.ts).
    await tx.session.deleteMany({ where: { userId } });
    await tx.teamMember.deleteMany({ where: { userId } });
    await tx.pushSubscription.deleteMany({ where: { userId } });
    const keptTasks = await tx.task.count({ where: { assigneeId: userId } });
    return { name: user.name, keptTasks };
  });
}
