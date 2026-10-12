import { describe, expect, it } from "vitest";
import {
  canMemberTransition,
  completedOnTime,
  displayStatus,
  isDueSoon,
  isOverdue,
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
  it("allows only forward moves", () => {
    expect(canMemberTransition("PENDING", "IN_PROGRESS")).toBe(true);
    expect(canMemberTransition("PENDING", "COMPLETED")).toBe(true);
    expect(canMemberTransition("IN_PROGRESS", "COMPLETED")).toBe(true);
  });
  it("blocks moving backwards or reopening", () => {
    expect(canMemberTransition("IN_PROGRESS", "PENDING")).toBe(false);
    expect(canMemberTransition("COMPLETED", "IN_PROGRESS")).toBe(false);
    expect(canMemberTransition("COMPLETED", "PENDING")).toBe(false);
    expect(canMemberTransition("COMPLETED", "COMPLETED")).toBe(false);
  });
});
