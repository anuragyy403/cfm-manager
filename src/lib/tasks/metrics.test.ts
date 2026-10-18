import { describe, expect, it } from "vitest";
import { computeMetrics, type MetricTask } from "./metrics";

const now = new Date("2026-10-12T12:00:00Z");
const day = (d: number) => new Date(now.getTime() + d * 86_400_000);

function task(partial: Partial<MetricTask>): MetricTask {
  return {
    status: "PENDING",
    dueAt: day(5),
    assignedAt: day(-5),
    startedAt: null,
    completedAt: null,
    ...partial,
  };
}

describe("computeMetrics", () => {
  it("returns nulls for rates when there is nothing to measure", () => {
    const m = computeMetrics([], now);
    expect(m.total).toBe(0);
    expect(m.completionRate).toBeNull();
    expect(m.onTimeRate).toBeNull();
    expect(m.avgCompletionMs).toBeNull();
  });

  it("puts every task in exactly one bucket and computes the agreed rates", () => {
    const tasks = [
      task({ status: "COMPLETED", dueAt: day(-1), completedAt: day(-2) }), // on time
      task({ status: "COMPLETED", dueAt: day(-3), completedAt: day(-1) }), // late
      task({ status: "COMPLETED", dueAt: day(1), completedAt: day(-1) }), // on time
      task({ status: "IN_PROGRESS", dueAt: day(2) }), // in progress
      task({ status: "IN_PROGRESS", dueAt: day(-1) }), // overdue
      task({ status: "PENDING", dueAt: day(-2) }), // overdue
      task({ status: "PENDING", dueAt: day(3) }), // pending
    ];
    const m = computeMetrics(tasks, now);

    expect(m.total).toBe(7);
    expect(m.completed).toBe(3);
    expect(m.inProgress).toBe(1);
    expect(m.overdue).toBe(2);
    expect(m.pending).toBe(1);
    expect(m.completed + m.inProgress + m.overdue + m.pending).toBe(m.total);

    expect(m.completedOnTime).toBe(2);
    expect(m.completedLate).toBe(1);
    expect(m.completionRate).toBeCloseTo(3 / 7);
    expect(m.onTimeRate).toBeCloseTo(2 / 3);
  });

  it("averages time from assignment to completion", () => {
    const m = computeMetrics(
      [
        task({ status: "COMPLETED", assignedAt: day(-4), completedAt: day(-2), dueAt: day(0) }),
        task({ status: "COMPLETED", assignedAt: day(-4), completedAt: day(0), dueAt: day(1) }),
      ],
      now,
    );
    expect(m.avgCompletionMs).toBe(3 * 86_400_000);
  });

  it("counts only passed work as done; handed-in work is in review, not overdue", () => {
    const m = computeMetrics(
      [
        task({ status: "SUBMITTED", dueAt: day(-1), submittedAt: day(-2) }), // in review, deadline since passed
        task({ status: "COMPLETED", dueAt: day(-3), submittedAt: day(-4), completedAt: day(-1) }), // passed late, delivered on time
        task({ status: "COMPLETED", dueAt: day(1), submittedAt: day(-1), completedAt: day(0), timesFailed: 2 }),
        task({ status: "IN_PROGRESS", dueAt: day(-1), timesFailed: 1 }), // sent back and now overdue
      ],
      now,
    );
    expect(m.completed).toBe(2);
    expect(m.inReview).toBe(1);
    expect(m.overdue).toBe(1);
    expect(m.completed + m.inReview + m.inProgress + m.overdue + m.pending).toBe(m.total);
    expect(m.completionRate).toBeCloseTo(2 / 4);
    // Both were handed in by their deadlines, however long the review took.
    expect(m.completedOnTime).toBe(2);
    expect(m.passedFirstTime).toBe(1);
    expect(m.firstTimePassRate).toBeCloseTo(1 / 2);
  });
});
