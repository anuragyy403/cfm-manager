import { completedOnTime, deliveredAt, isOverdue, type TaskStatus } from "./rules";

export type MetricTask = {
  status: TaskStatus;
  dueAt: Date;
  assignedAt: Date;
  startedAt: Date | null;
  submittedAt?: Date | null;
  completedAt: Date | null;
  /** How many times the reviewer sent it back. */
  timesFailed?: number;
};

export type TaskMetrics = {
  total: number;
  /** Passed by the reviewer. Only these count as done. */
  completed: number;
  /** Handed in and waiting for the reviewer. */
  inReview: number;
  inProgress: number;
  /** Not started yet and not overdue. */
  pending: number;
  /** Still with the assignee and past the deadline (counted separately from pending/in progress). */
  overdue: number;
  completedOnTime: number;
  completedLate: number;
  /** Passed tasks that were never sent back. */
  passedFirstTime: number;
  /** completed ÷ total, or null when there are no tasks. */
  completionRate: number | null;
  /** completed on time ÷ completed, or null when nothing is completed. */
  onTimeRate: number | null;
  /** passed first time ÷ completed, or null when nothing is completed. */
  firstTimePassRate: number | null;
  /** Mean time from assignment to handing in the work that passed, in milliseconds. */
  avgCompletionMs: number | null;
};

/**
 * Computes the agreed metrics for a set of (non-archived) tasks.
 *
 * Every task falls into exactly one of: completed, in review, overdue,
 * in progress, pending, so those five counts always add up to `total`.
 */
export function computeMetrics(tasks: MetricTask[], now = new Date()): TaskMetrics {
  let completed = 0;
  let inReview = 0;
  let inProgress = 0;
  let pending = 0;
  let overdue = 0;
  let onTime = 0;
  let firstTime = 0;
  let completionMsSum = 0;

  for (const t of tasks) {
    if (t.status === "COMPLETED") {
      completed++;
      if (completedOnTime(t)) onTime++;
      if (!t.timesFailed) firstTime++;
      const delivered = deliveredAt(t);
      if (delivered) completionMsSum += delivered.getTime() - t.assignedAt.getTime();
    } else if (t.status === "SUBMITTED") {
      inReview++;
    } else if (isOverdue(t, now)) {
      overdue++;
    } else if (t.status === "IN_PROGRESS") {
      inProgress++;
    } else {
      pending++;
    }
  }

  const total = tasks.length;
  return {
    total,
    completed,
    inReview,
    inProgress,
    pending,
    overdue,
    completedOnTime: onTime,
    completedLate: completed - onTime,
    passedFirstTime: firstTime,
    completionRate: total ? completed / total : null,
    onTimeRate: completed ? onTime / completed : null,
    firstTimePassRate: completed ? firstTime / completed : null,
    avgCompletionMs: completed ? completionMsSum / completed : null,
  };
}
