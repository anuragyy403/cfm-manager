/**
 * Pure task rules shared by the server and the UI. No database or framework
 * imports here so the rules can be unit-tested directly.
 */

export const TASK_STATUSES = ["PENDING", "IN_PROGRESS", "SUBMITTED", "COMPLETED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** What the UI shows: the stored status, or OVERDUE when the deadline has passed. */
export type DisplayStatus = TaskStatus | "OVERDUE";

/** "Due soon" window: deadline within the next 48 hours. */
export const DUE_SOON_MS = 48 * 60 * 60 * 1000;

type Timed = { status: TaskStatus; dueAt: Date };

/**
 * Whether the work is still with the assignee. Once handed in (in review) or
 * passed, the deadline no longer counts against them: a slow review must not
 * make the assignee look late.
 */
export function isOpen(status: TaskStatus) {
  return status === "PENDING" || status === "IN_PROGRESS";
}

export function isOverdue(task: Timed, now = new Date()) {
  return isOpen(task.status) && task.dueAt.getTime() < now.getTime();
}

export function isDueSoon(task: Timed, now = new Date()) {
  const remaining = task.dueAt.getTime() - now.getTime();
  return isOpen(task.status) && remaining >= 0 && remaining <= DUE_SOON_MS;
}

export function displayStatus(task: Timed, now = new Date()): DisplayStatus {
  return isOverdue(task, now) ? "OVERDUE" : task.status;
}

/** When the assignee handed the work in (falls back to completion for old tasks). */
export function deliveredAt(task: { completedAt: Date | null; submittedAt?: Date | null }) {
  return task.submittedAt ?? task.completedAt;
}

/**
 * A passed task counts as on time when the assignee handed it in by the
 * deadline. The time the reviewer took doesn't count against them.
 */
export function completedOnTime(task: { completedAt: Date | null; submittedAt?: Date | null; dueAt: Date }) {
  const delivered = deliveredAt(task);
  return task.completedAt !== null && delivered !== null && delivered.getTime() <= task.dueAt.getTime();
}

/** Whether work waiting for review was handed in by the deadline. */
export function submittedOnTime(task: { submittedAt: Date | null; dueAt: Date }) {
  return task.submittedAt !== null && task.submittedAt.getTime() <= task.dueAt.getTime();
}

/** The reviewer sent it back (or a lead reopened it) and the assignee has to redo it. */
export function changesRequested(task: { status: TaskStatus; reviewNote?: string | null }) {
  return isOpen(task.status) && !!task.reviewNote;
}

/**
 * Who reviews a task: its team's manager, except when the manager is the
 * assignee (their own work, or work the owner gave them). Then the owner
 * reviews it, so nobody passes their own work. The owner may also review
 * anything.
 */
export function reviewerIsOwner(task: { assigneeId: string; team: { managerId: string } }) {
  return task.assigneeId === task.team.managerId;
}

/**
 * Status changes an assignee may make on their own task. They hand work in
 * for review; only the reviewer can pass it (COMPLETED) or send it back.
 */
const MEMBER_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  PENDING: ["IN_PROGRESS", "SUBMITTED"],
  IN_PROGRESS: ["SUBMITTED"],
  SUBMITTED: [],
  COMPLETED: [],
};

export function canMemberTransition(from: TaskStatus, to: TaskStatus) {
  return MEMBER_TRANSITIONS[from].includes(to);
}

export const STATUS_LABELS: Record<DisplayStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  SUBMITTED: "In review",
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
