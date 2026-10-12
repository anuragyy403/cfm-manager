import { completedOnTime, isOverdue, type TaskStatus } from "./rules";

export type MetricTask = {
  status: TaskStatus;
  dueAt: Date;
  assignedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
};

export type TaskMetrics = {
  total: number;
  completed: number;
  inProgress: number;
  /** Not started yet and not overdue. */
  pending: number;
  /** Not completed and past the deadline (counted separately from pending/in progress). */
  overdue: number;
  completedOnTime: number;
  completedLate: number;
  /** completed ÷ total, or null when there are no tasks. */
  completionRate: number | null;
  /** completed on time ÷ completed, or null when nothing is completed. */
  onTimeRate: number | null;
  /** Mean time from assignment to completion, in milliseconds. */
  avgCompletionMs: number | null;
};

/**
 * Computes the agreed metrics for a set of (non-archived) tasks.
 *
 * Every task falls into exactly one of: completed, overdue, in progress,
 * pending, so those four counts always add up to `total`.
 */
export function computeMetrics(tasks: MetricTask[], now = new Date()): TaskMetrics {
  let completed = 0;
  let inProgress = 0;
  let pending = 0;
  let overdue = 0;
  let onTime = 0;
  let completionMsSum = 0;

  for (const t of tasks) {
    if (t.status === "COMPLETED") {
      completed++;
      if (completedOnTime(t)) onTime++;
      if (t.completedAt) completionMsSum += t.completedAt.getTime() - t.assignedAt.getTime();
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
    inProgress,
    pending,
    overdue,
    completedOnTime: onTime,
    completedLate: completed - onTime,
    completionRate: total ? completed / total : null,
    onTimeRate: completed ? onTime / completed : null,
    avgCompletionMs: completed ? completionMsSum / completed : null,
  };
}
