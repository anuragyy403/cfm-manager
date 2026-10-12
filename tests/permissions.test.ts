/**
 * Integration tests for the permission rules in PROJECT_BRIEF.md, run against
 * the real data-access layer and a local test database.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/server/session";
import {
  completeMyTask,
  createTask,
  getMyTask,
  getTaskForAdmin,
  listMyTasks,
  listTeamTasks,
  reopenTask,
  startMyTask,
  updateTask,
} from "@/server/tasks";
import { addMember, DomainError, removeMember, searchUsers } from "@/server/teams";

async function makeUser(name: string, role: "ADMIN" | "MEMBER"): Promise<CurrentUser> {
  const username = `${name.toLowerCase().replace(/\s+/g, "")}${randomUUID().slice(0, 6)}`;
  return prisma.user.create({
    data: { id: randomUUID(), name, email: `${username}@test.local`, username, role },
    select: { id: true, name: true, email: true, username: true, image: true, role: true },
  });
}

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

let adminA: CurrentUser;
let adminB: CurrentUser;
let alice: CurrentUser; // on A's team
let bob: CurrentUser; // on A's team
let carol: CurrentUser; // on B's team
let outsider: CurrentUser; // on no team

async function wipe() {
  await prisma.taskActivity.deleteMany();
  await prisma.task.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
}

beforeAll(async () => {
  await wipe();
});

beforeEach(async () => {
  await wipe();
  adminA = await makeUser("Admin A", "ADMIN");
  adminB = await makeUser("Admin B", "ADMIN");
  alice = await makeUser("Alice Member", "MEMBER");
  bob = await makeUser("Bob Member", "MEMBER");
  carol = await makeUser("Carol Member", "MEMBER");
  outsider = await makeUser("Olivia Outsider", "MEMBER");

  await prisma.team.create({
    data: {
      name: "Team A",
      ownerId: adminA.id,
      members: { create: [{ userId: alice.id }, { userId: bob.id }] },
    },
  });
  await prisma.team.create({
    data: { name: "Team B", ownerId: adminB.id, members: { create: [{ userId: carol.id }] } },
  });
});

afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

const newTask = (assigneeId: string) => ({
  title: "Write the quarterly report",
  description: "Numbers and commentary",
  priority: "HIGH" as const,
  dueAt: inDays(3),
  assigneeId,
});

describe("task assignment (admin only, own team only)", () => {
  it("admin can assign a task to a member of their team and it is logged", async () => {
    const task = await createTask(adminA, newTask(alice.id));
    expect(task.status).toBe("PENDING");
    const activity = await prisma.taskActivity.findMany({ where: { taskId: task.id } });
    expect(activity.map((a) => a.type)).toEqual(["CREATED"]);
  });

  it("rejects assigning to someone outside the admin's team", async () => {
    await expect(createTask(adminA, newTask(carol.id))).rejects.toThrow(DomainError);
    await expect(createTask(adminA, newTask(outsider.id))).rejects.toThrow(DomainError);
  });

  it("rejects reassigning to someone outside the team", async () => {
    const task = await createTask(adminA, newTask(alice.id));
    await expect(updateTask(adminA, task.id, newTask(carol.id))).rejects.toThrow(DomainError);
  });

  it("an admin cannot see or change another admin's tasks", async () => {
    const task = await createTask(adminA, newTask(alice.id));
    await expect(getTaskForAdmin(adminB, task.id)).rejects.toThrow();
    await expect(updateTask(adminB, task.id, newTask(carol.id))).rejects.toThrow();
    expect(await listTeamTasks(adminB)).toHaveLength(0);
  });

  it("reassigning resets progress and is logged", async () => {
    const task = await createTask(adminA, newTask(alice.id));
    await startMyTask(alice, task.id);
    await updateTask(adminA, task.id, newTask(bob.id));
    const updated = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated.assigneeId).toBe(bob.id);
    expect(updated.status).toBe("PENDING");
    expect(updated.startedAt).toBeNull();
    const types = (await prisma.taskActivity.findMany({ where: { taskId: task.id } })).map((a) => a.type);
    expect(types).toContain("REASSIGNED");
  });
});

describe("member access (own tasks only)", () => {
  it("a member sees only their own tasks", async () => {
    await createTask(adminA, newTask(alice.id));
    await createTask(adminA, newTask(bob.id));
    const mine = await listMyTasks(alice);
    expect(mine).toHaveLength(1);
    expect(mine.every((t) => t.assignee.id === alice.id)).toBe(true);
  });

  it("a member cannot open or update another member's task", async () => {
    const bobsTask = await createTask(adminA, newTask(bob.id));
    await expect(getMyTask(alice, bobsTask.id)).rejects.toThrow();
    await expect(startMyTask(alice, bobsTask.id)).rejects.toThrow(DomainError);
    await expect(completeMyTask(alice, bobsTask.id, "done it")).rejects.toThrow(DomainError);
    const unchanged = await prisma.task.findUniqueOrThrow({ where: { id: bobsTask.id } });
    expect(unchanged.status).toBe("PENDING");
  });

  it("a member removed from the team loses access to its tasks", async () => {
    const task = await createTask(adminA, newTask(alice.id));
    await removeMember(adminA, alice.id);
    expect(await listMyTasks(alice)).toHaveLength(0);
    await expect(startMyTask(alice, task.id)).rejects.toThrow(DomainError);
    // History is kept.
    expect(await prisma.task.count({ where: { id: task.id } })).toBe(1);
  });

  it("archived tasks are hidden from the member", async () => {
    const task = await createTask(adminA, newTask(alice.id));
    await prisma.task.update({ where: { id: task.id }, data: { archivedAt: new Date() } });
    expect(await listMyTasks(alice)).toHaveLength(0);
    await expect(startMyTask(alice, task.id)).rejects.toThrow(DomainError);
  });
});

describe("status workflow", () => {
  it("records server-side timestamps and activity for start and completion", async () => {
    const task = await createTask(adminA, newTask(alice.id));
    const before = Date.now();
    await startMyTask(alice, task.id);
    await completeMyTask(alice, task.id, "Report sent to the client.");
    const done = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });

    expect(done.status).toBe("COMPLETED");
    expect(done.startedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(done.completedAt!.getTime()).toBeGreaterThanOrEqual(done.startedAt!.getTime());
    expect(done.completionNote).toBe("Report sent to the client.");

    const activity = await prisma.taskActivity.findMany({ where: { taskId: task.id }, orderBy: { createdAt: "asc" } });
    expect(activity.map((a) => a.type)).toEqual(["CREATED", "STARTED", "COMPLETED"]);
    expect(activity.every((a) => a.actorId === adminA.id || a.actorId === alice.id)).toBe(true);
  });

  it("a member cannot complete twice or move a completed task back", async () => {
    const task = await createTask(adminA, newTask(alice.id));
    await completeMyTask(alice, task.id, "All done here.");
    await expect(completeMyTask(alice, task.id, "Again")).rejects.toThrow(DomainError);
    await expect(startMyTask(alice, task.id)).rejects.toThrow(DomainError);
  });

  it("only the admin can reopen, only completed tasks, and the reason is logged", async () => {
    const task = await createTask(adminA, newTask(alice.id));
    await expect(reopenTask(adminA, task.id, "Not finished yet")).rejects.toThrow(DomainError);
    await startMyTask(alice, task.id);
    await completeMyTask(alice, task.id, "Finished the work.");
    await expect(reopenTask(adminB, task.id, "Not my team")).rejects.toThrow();

    await reopenTask(adminA, task.id, "Missing the appendix");
    const reopened = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(reopened.status).toBe("IN_PROGRESS");
    expect(reopened.completedAt).toBeNull();
    const log = await prisma.taskActivity.findFirstOrThrow({ where: { taskId: task.id, type: "REOPENED" } });
    expect(log.details).toMatchObject({ reason: "Missing the appendix", previousCompletionNote: "Finished the work." });
  });
});

describe("team management", () => {
  it("search returns members by name or username, never admins or emails", async () => {
    const results = await searchUsers(adminA, "member");
    expect(results.map((r) => r.name).sort()).toEqual(["Alice Member", "Bob Member", "Carol Member"]);
    expect(results.find((r) => r.name === "Alice Member")!.inTeam).toBe(true);
    expect(results.find((r) => r.name === "Carol Member")!.inTeam).toBe(false);
    expect(results.every((r) => !("email" in r))).toBe(true);
    expect(await searchUsers(adminA, "admin")).toHaveLength(0);
  });

  it("admins cannot be added as team members", async () => {
    await expect(addMember(adminA, adminB.id)).rejects.toThrow(DomainError);
  });

  it("adding someone is idempotent", async () => {
    await addMember(adminA, outsider.id);
    await addMember(adminA, outsider.id);
    const team = await prisma.team.findFirstOrThrow({ where: { ownerId: adminA.id } });
    expect(await prisma.teamMember.count({ where: { teamId: team.id, userId: outsider.id } })).toBe(1);
  });
});
