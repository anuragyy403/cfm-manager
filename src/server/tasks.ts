import "server-only";
import { notFound } from "next/navigation";
import type { Prisma, TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { canMemberTransition, completedOnTime, DUE_SOON_MS } from "@/lib/tasks/rules";
import type { TaskInput } from "@/lib/validation";
import type { CurrentUser } from "@/server/session";
import { DomainError, getAdminTeam, isTeamMember } from "@/server/teams";

/**
 * Task data access. Admin functions are scoped to the admin's own team;
 * member functions are scoped to tasks assigned to that member in a team they
 * currently belong to. Callers pass an already-verified user.
 */

export const taskListSelect = {
  id: true,
  title: true,
  priority: true,
  status: true,
  dueAt: true,
  assignedAt: true,
  startedAt: true,
  completedAt: true,
  archivedAt: true,
  assignee: { select: { id: true, name: true, username: true } },
} satisfies Prisma.TaskSelect;

export type TaskListItem = Prisma.TaskGetPayload<{ select: typeof taskListSelect }>;

export const TASK_VIEWS = [
  "all",
  "PENDING",
  "IN_PROGRESS",
  "OVERDUE",
  "COMPLETED",
  "archived",
] as const;
export type TaskView = (typeof TASK_VIEWS)[number];

/** Prisma filter matching a display status (overdue is derived from the deadline). */
export function viewWhere(view: TaskView, now = new Date()): Prisma.TaskWhereInput {
  switch (view) {
    case "archived":
      return { archivedAt: { not: null } };
    case "OVERDUE":
      return { archivedAt: null, status: { not: "COMPLETED" }, dueAt: { lt: now } };
    case "PENDING":
    case "IN_PROGRESS":
      return { archivedAt: null, status: view, dueAt: { gte: now } };
    case "COMPLETED":
      return { archivedAt: null, status: "COMPLETED" };
    default:
      return { archivedAt: null };
  }
}

const activityInclude = {
  activities: {
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { id: true, name: true } } },
  },
} satisfies Prisma.TaskInclude;

// ─── Admin ──────────────────────────────────────────────────────────────────

export type AdminTaskFilters = {
  view?: TaskView;
  assigneeId?: string;
  priority?: string;
  q?: string;
};

export async function listTeamTasks(admin: CurrentUser, filters: AdminTaskFilters = {}) {
  const team = await getAdminTeam(admin);
  if (!team) return [];
  const view = filters.view ?? "all";
  const where: Prisma.TaskWhereInput = {
    teamId: team.id,
    ...viewWhere(view),
    ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
    ...(filters.priority ? { priority: filters.priority as Prisma.TaskWhereInput["priority"] } : {}),
    ...(filters.q ? { title: { contains: filters.q, mode: "insensitive" } } : {}),
  };
  return prisma.task.findMany({
    where,
    select: taskListSelect,
    orderBy: view === "COMPLETED" ? { completedAt: "desc" } : { dueAt: "asc" },
    take: 500,
  });
}

/** Number of team tasks in each view, for the filter tabs. */
export async function countTeamTasksByView(admin: CurrentUser) {
  const team = await getAdminTeam(admin);
  const counts = Object.fromEntries(TASK_VIEWS.map((v) => [v, 0])) as Record<TaskView, number>;
  if (!team) return counts;
  const now = new Date();
  const results = await Promise.all(
    TASK_VIEWS.map((v) => prisma.task.count({ where: { teamId: team.id, ...viewWhere(v, now) } })),
  );
  TASK_VIEWS.forEach((v, i) => (counts[v] = results[i]!));
  return counts;
}

export async function getTaskForAdmin(admin: CurrentUser, taskId: string) {
  const team = await getAdminTeam(admin);
  if (!team) notFound();
  const task = await prisma.task.findFirst({
    where: { id: taskId, teamId: team.id },
    include: {
      assignee: { select: { id: true, name: true, username: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      ...activityInclude,
    },
  });
  if (!task) notFound();
  return task;
}

async function requireTeamAndAssignee(admin: CurrentUser, assigneeId: string) {
  const team = await getAdminTeam(admin);
  if (!team) throw new DomainError("Create your team before assigning tasks.");
  if (!(await isTeamMember(team.id, assigneeId))) {
    throw new DomainError("Tasks can only be assigned to members of your team.");
  }
  return team;
}

export async function createTask(admin: CurrentUser, input: TaskInput) {
  const team = await requireTeamAndAssignee(admin, input.assigneeId);
  return prisma.task.create({
    data: {
      title: input.title,
      description: input.description,
      priority: input.priority,
      dueAt: new Date(input.dueAt),
      teamId: team.id,
      assigneeId: input.assigneeId,
      createdById: admin.id,
      activities: {
        create: { actorId: admin.id, type: "CREATED", toStatus: "PENDING" },
      },
    },
  });
}

export async function updateTask(admin: CurrentUser, taskId: string, input: TaskInput) {
  const existing = await getTaskForAdmin(admin, taskId);
  if (existing.archivedAt) throw new DomainError("Restore this task before editing it.");

  const reassigned = input.assigneeId !== existing.assigneeId;
  if (reassigned) {
    if (existing.status === "COMPLETED") {
      throw new DomainError("Reopen this task before reassigning it.");
    }
    await requireTeamAndAssignee(admin, input.assigneeId);
  }

  const dueAt = new Date(input.dueAt);
  const changed: string[] = [];
  if (input.title !== existing.title) changed.push("title");
  if (input.description !== existing.description) changed.push("description");
  if (input.priority !== existing.priority) changed.push("priority");
  if (dueAt.getTime() !== existing.dueAt.getTime()) changed.push("deadline");

  if (!reassigned && changed.length === 0) return existing;

  const activities: Prisma.TaskActivityCreateManyTaskInput[] = [];
  if (changed.length) {
    activities.push({
      actorId: admin.id,
      type: "UPDATED",
      details: {
        fields: changed,
        ...(changed.includes("deadline") ? { previousDueAt: existing.dueAt.toISOString() } : {}),
        ...(changed.includes("priority") ? { previousPriority: existing.priority } : {}),
      },
    });
  }

  // A new assignee starts fresh: the task goes back to pending.
  let statusData: Prisma.TaskUpdateInput = {};
  if (reassigned) {
    statusData = { status: "PENDING", startedAt: null, assignedAt: new Date() };
    activities.push({
      actorId: admin.id,
      type: "REASSIGNED",
      fromStatus: existing.status,
      toStatus: "PENDING",
      details: { fromAssigneeId: existing.assigneeId, toAssigneeId: input.assigneeId },
    });
  }

  return prisma.task.update({
    where: { id: existing.id },
    data: {
      title: input.title,
      description: input.description,
      priority: input.priority,
      dueAt,
      ...(reassigned ? { assignee: { connect: { id: input.assigneeId } } } : {}),
      ...statusData,
      activities: { createMany: { data: activities } },
    },
  });
}

export async function setTaskArchived(admin: CurrentUser, taskId: string, archived: boolean) {
  const task = await getTaskForAdmin(admin, taskId);
  if (Boolean(task.archivedAt) === archived) return;
  await prisma.task.update({
    where: { id: task.id },
    data: {
      archivedAt: archived ? new Date() : null,
      activities: {
        create: { actorId: admin.id, type: archived ? "ARCHIVED" : "RESTORED" },
      },
    },
  });
}

export async function reopenTask(admin: CurrentUser, taskId: string, reason: string) {
  const task = await getTaskForAdmin(admin, taskId);
  if (task.status !== "COMPLETED") throw new DomainError("Only completed tasks can be reopened.");
  if (task.archivedAt) throw new DomainError("Restore this task before reopening it.");
  const toStatus: TaskStatus = task.startedAt ? "IN_PROGRESS" : "PENDING";

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.task.updateMany({
      where: { id: task.id, status: "COMPLETED" },
      data: { status: toStatus, completedAt: null, completionNote: null },
    });
    if (count === 0) {
      throw new DomainError("This task changed in the meantime. Refresh and try again.");
    }
    await tx.taskActivity.create({
      data: {
        taskId: task.id,
        actorId: admin.id,
        type: "REOPENED",
        fromStatus: "COMPLETED",
        toStatus,
        details: {
          reason,
          previousCompletedAt: task.completedAt?.toISOString() ?? null,
          previousCompletionNote: task.completionNote,
        },
      },
    });
  });
}

/** Open tasks that are overdue or due within 48 hours, most urgent first. */
export async function listAttentionTasks(admin: CurrentUser, take = 8) {
  const team = await getAdminTeam(admin);
  if (!team) return [];
  return prisma.task.findMany({
    where: {
      teamId: team.id,
      archivedAt: null,
      status: { not: "COMPLETED" },
      dueAt: { lte: new Date(Date.now() + DUE_SOON_MS) },
    },
    select: taskListSelect,
    orderBy: { dueAt: "asc" },
    take,
  });
}

/** Recent activity across the admin's team, newest first. */
export async function listTeamActivity(admin: CurrentUser, take = 12) {
  const team = await getAdminTeam(admin);
  if (!team) return [];
  return prisma.taskActivity.findMany({
    where: { task: { teamId: team.id } },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      actor: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    },
  });
}

// ─── Member ─────────────────────────────────────────────────────────────────

/** Tasks visible to a member: assigned to them, not archived, in a team they're still on. */
function memberScope(member: CurrentUser): Prisma.TaskWhereInput {
  return {
    assigneeId: member.id,
    archivedAt: null,
    team: { members: { some: { userId: member.id } } },
  };
}

export async function listMyTasks(member: CurrentUser, view: TaskView = "all") {
  return prisma.task.findMany({
    where: { ...viewWhere(view === "archived" ? "all" : view), ...memberScope(member) },
    select: { ...taskListSelect, description: true },
    orderBy: view === "COMPLETED" ? { completedAt: "desc" } : { dueAt: "asc" },
  });
}

export async function getMyTask(member: CurrentUser, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, ...memberScope(member) },
    include: {
      createdBy: { select: { id: true, name: true } },
      ...activityInclude,
    },
  });
  if (!task) notFound();
  return task;
}

async function transitionMyTask(
  member: CurrentUser,
  taskId: string,
  to: TaskStatus,
  note?: string,
) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, ...memberScope(member) },
    select: { id: true, status: true, dueAt: true },
  });
  if (!task) throw new DomainError("Task not found.");
  if (!canMemberTransition(task.status, to)) {
    throw new DomainError(
      task.status === "COMPLETED"
        ? "This task is already completed."
        : "That status change isn't allowed.",
    );
  }

  const now = new Date();
  const data: Prisma.TaskUpdateManyMutationInput =
    to === "IN_PROGRESS"
      ? { status: "IN_PROGRESS", startedAt: now }
      : { status: "COMPLETED", completedAt: now, completionNote: note ?? null };

  await prisma.$transaction(async (tx) => {
    // Conditional update guards against double submits and concurrent changes.
    const { count } = await tx.task.updateMany({
      where: { id: task.id, status: task.status, assigneeId: member.id },
      data,
    });
    if (count === 0) {
      throw new DomainError("This task changed in the meantime. Refresh and try again.");
    }
    await tx.taskActivity.create({
      data: {
        taskId: task.id,
        actorId: member.id,
        type: to === "IN_PROGRESS" ? "STARTED" : "COMPLETED",
        fromStatus: task.status,
        toStatus: to,
        details:
          to === "COMPLETED"
            ? { onTime: completedOnTime({ completedAt: now, dueAt: task.dueAt }) }
            : undefined,
      },
    });
  });
}

export function startMyTask(member: CurrentUser, taskId: string) {
  return transitionMyTask(member, taskId, "IN_PROGRESS");
}

export function completeMyTask(member: CurrentUser, taskId: string, note: string) {
  return transitionMyTask(member, taskId, "COMPLETED", note);
}
