import "server-only";
import { notFound } from "next/navigation";
import type { Prisma, TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { canMemberTransition, completedOnTime, DUE_SOON_MS } from "@/lib/tasks/rules";
import type { TaskInput, TaskUpdateInput } from "@/lib/validation";
import { canAddSubtask, canManageTask, DomainError, myWorkScope, taskScope, teamScope } from "@/server/access";
import type { CurrentUser } from "@/server/session";
import { isAssignableInTeam } from "@/server/teams";

/**
 * Task data access.
 *   - Lead functions (owner / manager) are scoped to the lead's teams, see
 *     `src/server/access.ts`.
 *   - "My work" functions are scoped to tasks assigned to that person in a
 *     team they still belong to; employees and managers both use them.
 * Callers pass an already-verified user.
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
  parentId: true,
  assignee: { select: { id: true, name: true, username: true } },
  team: { select: { id: true, name: true } },
  parent: { select: { id: true, title: true } },
  _count: { select: { subtasks: { where: { archivedAt: null } } } },
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

// ─── Leads (owner and managers) ─────────────────────────────────────────────

export type TaskFilters = {
  view?: TaskView;
  assigneeId?: string;
  teamId?: string;
  priority?: string;
  q?: string;
};

function filterWhere(viewer: CurrentUser, filters: Omit<TaskFilters, "view">): Prisma.TaskWhereInput {
  return {
    ...taskScope(viewer),
    ...(filters.teamId ? { teamId: filters.teamId } : {}),
    ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
    ...(filters.priority ? { priority: filters.priority as Prisma.TaskWhereInput["priority"] } : {}),
    ...(filters.q ? { title: { contains: filters.q, mode: "insensitive" } } : {}),
  };
}

export async function listTasks(viewer: CurrentUser, filters: TaskFilters = {}) {
  const view = filters.view ?? "all";
  return prisma.task.findMany({
    where: { AND: [filterWhere(viewer, filters), viewWhere(view)] },
    select: taskListSelect,
    orderBy: view === "COMPLETED" ? { completedAt: "desc" } : { dueAt: "asc" },
    take: 500,
  });
}

/** Number of tasks in each view, for the filter tabs. */
export async function countTasksByView(viewer: CurrentUser, filters: { teamId?: string } = {}) {
  const counts = Object.fromEntries(TASK_VIEWS.map((v) => [v, 0])) as Record<TaskView, number>;
  const now = new Date();
  const base = filterWhere(viewer, filters);
  const results = await Promise.all(
    TASK_VIEWS.map((v) => prisma.task.count({ where: { AND: [base, viewWhere(v, now)] } })),
  );
  TASK_VIEWS.forEach((v, i) => (counts[v] = results[i]!));
  return counts;
}

const taskDetailInclude = {
  assignee: { select: { id: true, name: true, username: true, email: true, role: true } },
  createdBy: { select: { id: true, name: true, role: true } },
  team: {
    select: {
      id: true,
      name: true,
      managerId: true,
      manager: { select: { id: true, name: true, role: true } },
      members: { select: { userId: true } },
    },
  },
  parent: { select: { id: true, title: true, assignee: { select: { id: true, name: true } } } },
  subtasks: { select: taskListSelect, orderBy: [{ archivedAt: "asc" }, { dueAt: "asc" }] },
  ...activityInclude,
} satisfies Prisma.TaskInclude;

/** A task a lead can see, with everything the detail page needs. 404 otherwise. */
export async function getTask(viewer: CurrentUser, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, ...taskScope(viewer) },
    include: taskDetailInclude,
  });
  if (!task) notFound();
  return task;
}

async function findTaskInScope(viewer: CurrentUser, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, ...taskScope(viewer) },
    include: {
      createdBy: { select: { role: true } },
      team: { select: { managerId: true } },
    },
  });
  if (!task) throw new DomainError("Task not found.");
  return task;
}

async function findManageableTask(viewer: CurrentUser, taskId: string) {
  const task = await findTaskInScope(viewer, taskId);
  if (!canManageTask(viewer, task)) {
    throw new DomainError("This task was assigned by the owner, so only the owner can change it.");
  }
  return task;
}

async function assertAssignable(teamId: string, assigneeId: string) {
  if (!(await isAssignableInTeam(teamId, assigneeId))) {
    throw new DomainError("Tasks can only be assigned to this team's manager or its employees.");
  }
}

/**
 * Creates a task, or a subtask when `parentId` is set. A subtask always lives
 * in its parent's team and is logged on the parent as well.
 */
export async function createTask(viewer: CurrentUser, input: TaskInput) {
  let teamId = input.teamId;
  let parentId: string | null = null;

  if (input.parentId) {
    const parent = await findTaskInScope(viewer, input.parentId);
    if (!canAddSubtask(viewer, parent)) {
      throw new DomainError(
        parent.parentId
          ? "A subtask can't be split further."
          : parent.status === "COMPLETED" || parent.archivedAt
            ? "Subtasks can only be added to open tasks."
            : "Only the owner or this team's manager can add subtasks.",
      );
    }
    teamId = parent.teamId;
    parentId = parent.id;
  } else {
    const team = await prisma.team.findFirst({ where: { id: teamId, ...teamScope(viewer) }, select: { id: true } });
    if (!team) throw new DomainError("Choose one of your teams.");
  }
  await assertAssignable(teamId, input.assigneeId);

  return prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        title: input.title,
        description: input.description,
        priority: input.priority,
        dueAt: new Date(input.dueAt),
        teamId,
        parentId,
        assigneeId: input.assigneeId,
        createdById: viewer.id,
        activities: {
          create: { actorId: viewer.id, type: "CREATED", toStatus: "PENDING" },
        },
      },
    });
    if (parentId) {
      await tx.taskActivity.create({
        data: {
          taskId: parentId,
          actorId: viewer.id,
          type: "SUBTASK_ADDED",
          details: { subtaskId: task.id, title: task.title, assigneeId: task.assigneeId },
        },
      });
    }
    return task;
  });
}

/** Returns the task and whether it went to a new assignee (they get notified). */
export async function updateTask(viewer: CurrentUser, taskId: string, input: TaskUpdateInput) {
  const existing = await findManageableTask(viewer, taskId);
  if (existing.archivedAt) throw new DomainError("Restore this task before editing it.");

  const reassigned = input.assigneeId !== existing.assigneeId;
  if (reassigned) {
    if (existing.status === "COMPLETED") {
      throw new DomainError("Reopen this task before reassigning it.");
    }
    await assertAssignable(existing.teamId, input.assigneeId);
  }

  const dueAt = new Date(input.dueAt);
  const changed: string[] = [];
  if (input.title !== existing.title) changed.push("title");
  if (input.description !== existing.description) changed.push("description");
  if (input.priority !== existing.priority) changed.push("priority");
  if (dueAt.getTime() !== existing.dueAt.getTime()) changed.push("deadline");

  if (!reassigned && changed.length === 0) return { task: existing, reassigned };

  const activities: Prisma.TaskActivityCreateManyTaskInput[] = [];
  if (changed.length) {
    activities.push({
      actorId: viewer.id,
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
      actorId: viewer.id,
      type: "REASSIGNED",
      fromStatus: existing.status,
      toStatus: "PENDING",
      details: { fromAssigneeId: existing.assigneeId, toAssigneeId: input.assigneeId },
    });
  }

  const task = await prisma.task.update({
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
  return { task, reassigned };
}

/** Archiving a task also archives its open subtasks; restoring brings back only the task. */
export async function setTaskArchived(viewer: CurrentUser, taskId: string, archived: boolean) {
  const task = await findManageableTask(viewer, taskId);
  if (Boolean(task.archivedAt) === archived) return;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: task.id },
      data: {
        archivedAt: archived ? now : null,
        activities: { create: { actorId: viewer.id, type: archived ? "ARCHIVED" : "RESTORED" } },
      },
    });
    if (archived) {
      const subtasks = await tx.task.findMany({
        where: { parentId: task.id, archivedAt: null },
        select: { id: true },
      });
      if (subtasks.length) {
        await tx.task.updateMany({ where: { id: { in: subtasks.map((s) => s.id) } }, data: { archivedAt: now } });
        await tx.taskActivity.createMany({
          data: subtasks.map((s) => ({
            taskId: s.id,
            actorId: viewer.id,
            type: "ARCHIVED" as const,
            details: { withParent: true },
          })),
        });
      }
    }
  });
}

export async function reopenTask(viewer: CurrentUser, taskId: string, reason: string) {
  const task = await findManageableTask(viewer, taskId);
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
        actorId: viewer.id,
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
export async function listAttentionTasks(viewer: CurrentUser, take = 8, teamId?: string) {
  return prisma.task.findMany({
    where: {
      ...taskScope(viewer),
      ...(teamId ? { teamId } : {}),
      archivedAt: null,
      status: { not: "COMPLETED" },
      dueAt: { lte: new Date(Date.now() + DUE_SOON_MS) },
    },
    select: taskListSelect,
    orderBy: { dueAt: "asc" },
    take,
  });
}

/** Recent activity across the lead's teams, newest first. */
export async function listActivity(viewer: CurrentUser, take = 12) {
  return prisma.taskActivity.findMany({
    where: { task: taskScope(viewer) },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      actor: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    },
  });
}

/** Names for everyone referenced in task history (reassignments, subtasks). */
export async function namesForActivities(activities: { details: unknown }[]) {
  const ids = new Set<string>();
  for (const a of activities) {
    const d = (a.details ?? {}) as { fromAssigneeId?: string; toAssigneeId?: string; assigneeId?: string };
    for (const id of [d.fromAssigneeId, d.toAssigneeId, d.assigneeId]) if (id) ids.add(id);
  }
  if (!ids.size) return {};
  const people = await prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } });
  return Object.fromEntries(people.map((p) => [p.id, p.name]));
}

// ─── My work (employees and managers) ───────────────────────────────────────

export async function listMyTasks(user: CurrentUser, view: TaskView = "all") {
  return prisma.task.findMany({
    where: { ...viewWhere(view === "archived" ? "all" : view), ...myWorkScope(user) },
    select: { ...taskListSelect, description: true },
    orderBy: view === "COMPLETED" ? { completedAt: "desc" } : { dueAt: "asc" },
  });
}

export async function getMyTask(user: CurrentUser, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, ...myWorkScope(user) },
    include: {
      createdBy: { select: { id: true, name: true } },
      parent: { select: { id: true, title: true } },
      ...activityInclude,
    },
  });
  if (!task) notFound();
  return task;
}

async function transitionMyTask(
  user: CurrentUser,
  taskId: string,
  to: TaskStatus,
  note?: string,
) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, ...myWorkScope(user) },
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
      where: { id: task.id, status: task.status, assigneeId: user.id },
      data,
    });
    if (count === 0) {
      throw new DomainError("This task changed in the meantime. Refresh and try again.");
    }
    await tx.taskActivity.create({
      data: {
        taskId: task.id,
        actorId: user.id,
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

export function startMyTask(user: CurrentUser, taskId: string) {
  return transitionMyTask(user, taskId, "IN_PROGRESS");
}

export function completeMyTask(user: CurrentUser, taskId: string, note: string) {
  return transitionMyTask(user, taskId, "COMPLETED", note);
}
