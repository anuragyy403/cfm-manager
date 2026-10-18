import { describe, expect, it } from "vitest";
import {
  canMemberTransition,
  changesRequested,
  completedOnTime,
  displayStatus,
  isDueSoon,
  isOverdue,
  reviewerIsOwner,
} from "./rules";

const now = new Date("2026-10-12T12:00:00Z");
const hours = (h: number) => new Date(now.getTime() + h * 3600_000);

describe("overdue and due soon", () => {
  it("an open task past its deadline is overdue", () => {
    expect(isOverdue({ status: "PENDING", dueAt: hours(-1) }, now)).toBe(true);
    expect(isOverdue({ status: "IN_PROGRESS", dueAt: hours(-1) }, now)).toBe(true);
    expect(displayStatus({ status: "IN_PROGRESS", dueAt: hours(-1) }, now)).toBe("OVERDUE");
  });

  it("a completed task is never overdue, even if late", () => {
    expect(isOverdue({ status: "COMPLETED", dueAt: hours(-100) }, now)).toBe(false);
    expect(displayStatus({ status: "COMPLETED", dueAt: hours(-100) }, now)).toBe("COMPLETED");
  });

  it("due soon means within the next 48 hours and not yet overdue", () => {
    expect(isDueSoon({ status: "PENDING", dueAt: hours(47) }, now)).toBe(true);
    expect(isDueSoon({ status: "PENDING", dueAt: hours(49) }, now)).toBe(false);
    expect(isDueSoon({ status: "PENDING", dueAt: hours(-1) }, now)).toBe(false);
    expect(isDueSoon({ status: "COMPLETED", dueAt: hours(5) }, now)).toBe(false);
  });
});

describe("completedOnTime", () => {
  it("is true when completed at or before the deadline", () => {
    expect(completedOnTime({ completedAt: hours(-1), dueAt: now })).toBe(true);
    expect(completedOnTime({ completedAt: now, dueAt: now })).toBe(true);
  });
  it("is false when completed after the deadline or not completed", () => {
    expect(completedOnTime({ completedAt: hours(1), dueAt: now })).toBe(false);
    expect(completedOnTime({ completedAt: null, dueAt: now })).toBe(false);
  });
});

describe("member status transitions", () => {
  it("allows only forward moves, up to handing in for review", () => {
    expect(canMemberTransition("PENDING", "IN_PROGRESS")).toBe(true);
    expect(canMemberTransition("PENDING", "SUBMITTED")).toBe(true);
    expect(canMemberTransition("IN_PROGRESS", "SUBMITTED")).toBe(true);
  });
  it("never lets the assignee mark their own work completed", () => {
    expect(canMemberTransition("PENDING", "COMPLETED")).toBe(false);
    expect(canMemberTransition("IN_PROGRESS", "COMPLETED")).toBe(false);
    expect(canMemberTransition("SUBMITTED", "COMPLETED")).toBe(false);
  });
  it("blocks moving backwards, out of review, or reopening", () => {
    expect(canMemberTransition("IN_PROGRESS", "PENDING")).toBe(false);
    expect(canMemberTransition("SUBMITTED", "IN_PROGRESS")).toBe(false);
    expect(canMemberTransition("SUBMITTED", "SUBMITTED")).toBe(false);
    expect(canMemberTransition("COMPLETED", "IN_PROGRESS")).toBe(false);
    expect(canMemberTransition("COMPLETED", "PENDING")).toBe(false);
    expect(canMemberTransition("COMPLETED", "COMPLETED")).toBe(false);
  });
});

describe("review", () => {
  it("work waiting for review is never overdue or due soon, even past the deadline", () => {
    expect(isOverdue({ status: "SUBMITTED", dueAt: hours(-5) }, now)).toBe(false);
    expect(isDueSoon({ status: "SUBMITTED", dueAt: hours(5) }, now)).toBe(false);
    expect(displayStatus({ status: "SUBMITTED", dueAt: hours(-5) }, now)).toBe("SUBMITTED");
  });

  it("on time is judged by when the work was handed in, not when it passed", () => {
    const task = { dueAt: hours(0), submittedAt: hours(-1), completedAt: hours(24) };
    expect(completedOnTime(task)).toBe(true);
    expect(completedOnTime({ ...task, submittedAt: hours(1) })).toBe(false);
    // Completed before reviews existed: the completion time counts.
    expect(completedOnTime({ dueAt: hours(0), submittedAt: null, completedAt: hours(-1) })).toBe(true);
  });

  it("changes are requested only on open work with feedback", () => {
    expect(changesRequested({ status: "IN_PROGRESS", reviewNote: "Fix the footer" })).toBe(true);
    expect(changesRequested({ status: "IN_PROGRESS", reviewNote: null })).toBe(false);
    expect(changesRequested({ status: "COMPLETED", reviewNote: "Great work" })).toBe(false);
    expect(changesRequested({ status: "SUBMITTED", reviewNote: "old" })).toBe(false);
  });

  it("the owner reviews a manager's own work; the manager reviews everyone else's", () => {
    expect(reviewerIsOwner({ assigneeId: "mia", team: { managerId: "mia" } })).toBe(true);
    expect(reviewerIsOwner({ assigneeId: "alice", team: { managerId: "mia" } })).toBe(false);
  });
});
