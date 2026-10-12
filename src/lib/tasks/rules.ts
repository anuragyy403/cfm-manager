/**
 * Pure task rules shared by the server and the UI. No database or framework
 * imports here so the rules can be unit-tested directly.
 */

export const TASK_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** What the UI shows: the stored status, or OVERDUE when the deadline has passed. */
export type DisplayStatus = TaskStatus | "OVERDUE";

/** "Due soon" window: deadline within the next 48 hours. */
export const DUE_SOON_MS = 48 * 60 * 60 * 1000;

type Timed = { status: TaskStatus; dueAt: Date };

export function isOverdue(task: Timed, now = new Date()) {
  return task.status !== "COMPLETED" && task.dueAt.getTime() < now.getTime();
}

export function isDueSoon(task: Timed, now = new Date()) {
  const remaining = task.dueAt.getTime() - now.getTime();
  return task.status !== "COMPLETED" && remaining >= 0 && remaining <= DUE_SOON_MS;
}

export function displayStatus(task: Timed, now = new Date()): DisplayStatus {
  return isOverdue(task, now) ? "OVERDUE" : task.status;
}

/** A completed task counts as on time when it was completed by its deadline. */
export function completedOnTime(task: { completedAt: Date | null; dueAt: Date }) {
  return task.completedAt !== null && task.completedAt.getTime() <= task.dueAt.getTime();
}

/**
 * Status changes a team member may make on their own task.
 * Moving backwards (e.g. reopening a completed task) is an admin action.
 */
const MEMBER_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  PENDING: ["IN_PROGRESS", "COMPLETED"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
};

export function canMemberTransition(from: TaskStatus, to: TaskStatus) {
  return MEMBER_TRANSITIONS[from].includes(to);
}

export const STATUS_LABELS: Record<DisplayStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  OVERDUE: "Overdue",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

/** Higher number = more important; used for sorting. */
export const PRIORITY_RANK: Record<TaskPriority, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  URGENT: 3,
};
