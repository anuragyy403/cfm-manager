/**
 * Server Actions are public POST endpoints. These tests make sure every
 * admin action refuses a non-admin, and every member action refuses a
 * non-member, before doing anything else.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const DENIED = "DENIED_BY_ROLE_CHECK";

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/server/session", () => ({
  requireAdmin: vi.fn(async () => {
    throw new Error(DENIED);
  }),
  requireMember: vi.fn(async () => {
    throw new Error(DENIED);
  }),
}));

// Any data access reaching these mocks means the role check was skipped.
const { touched } = vi.hoisted(() => ({ touched: vi.fn() }));
vi.mock("@/server/tasks", () =>
  Object.fromEntries(
    [
      "createTask",
      "updateTask",
      "setTaskArchived",
      "reopenTask",
      "startMyTask",
      "completeMyTask",
    ].map((n) => [n, touched]),
  ),
);
vi.mock("@/server/teams", () => ({
  DomainError: class DomainError extends Error {},
  ...Object.fromEntries(
    ["createTeam", "updateTeam", "searchUsers", "addMember", "removeMember"].map((n) => [n, touched]),
  ),
}));

vi.mock("@/server/password-reset", () => ({ sendMemberPasswordReset: touched }));

beforeEach(() => touched.mockClear());

describe("admin actions reject non-admins", async () => {
  const actions = await import("@/server/actions/admin");
  for (const [name, fn] of Object.entries(actions)) {
    it(name, async () => {
      await expect((fn as (...a: unknown[]) => Promise<unknown>)("x", { title: "x" })).rejects.toThrow(DENIED);
      expect(touched).not.toHaveBeenCalled();
    });
  }
});

describe("member actions reject non-members", async () => {
  const actions = await import("@/server/actions/member");
  for (const [name, fn] of Object.entries(actions)) {
    it(name, async () => {
      await expect((fn as (...a: unknown[]) => Promise<unknown>)("x", { note: "done done" })).rejects.toThrow(DENIED);
      expect(touched).not.toHaveBeenCalled();
    });
  }
});
