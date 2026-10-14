/**
 * Server Actions are public POST endpoints. These tests make sure every
 * action checks the caller's role before doing anything else:
 *   - lead actions (owner or manager) call requireLead,
 *   - owner actions call requireOwner,
 *   - work actions (your own tasks) call requireAssignee.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const DENIED = "DENIED_BY_ROLE_CHECK";
const deny = () =>
  vi.fn(async () => {
    throw new Error(DENIED);
  });

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/server/session", () => ({
  requireLead: deny(),
  requireOwner: deny(),
  requireAssignee: deny(),
}));

// Any data access reaching these mocks means the role check was skipped.
const { touched } = vi.hoisted(() => ({ touched: vi.fn() }));
vi.mock("@/server/tasks", () =>
  Object.fromEntries(
    ["createTask", "updateTask", "setTaskArchived", "reopenTask", "startMyTask", "completeMyTask"].map((n) => [
      n,
      touched,
    ]),
  ),
);
vi.mock("@/server/teams", () =>
  Object.fromEntries(
    ["createTeam", "updateTeam", "searchUsers", "addMember", "removeMember", "setTeamManager"].map((n) => [
      n,
      touched,
    ]),
  ),
);
vi.mock("@/server/people", () => ({ setRole: touched }));
vi.mock("@/server/password-reset", () => ({ sendMemberPasswordReset: touched }));

beforeEach(() => touched.mockClear());

const modules = {
  lead: () => import("@/server/actions/lead"),
  owner: () => import("@/server/actions/owner"),
  work: () => import("@/server/actions/work"),
};

for (const [file, load] of Object.entries(modules)) {
  describe(`${file} actions reject callers without the right role`, async () => {
    const actions = await load();
    for (const [name, fn] of Object.entries(actions)) {
      it(name, async () => {
        await expect((fn as (...a: unknown[]) => Promise<unknown>)("x", { title: "x", note: "done done" })).rejects.toThrow(
          DENIED,
        );
        expect(touched).not.toHaveBeenCalled();
      });
    }
  });
}
