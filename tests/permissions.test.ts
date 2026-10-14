/**
 * Integration tests for the permission rules in PROJECT_BRIEF.md, run against
 * the real data-access layer and a local test database.
 *
 * Company used in every test:
 *   owner
 *   ├── Tech team      managed by Mia (manager): Alice, Bob
 *   └── Business team  managed by Noah (manager): Carol
 *   Olivia: an employee on no team yet
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/server/access";
import { getTeamAnalytics } from "@/server/analytics";
import { setRole } from "@/server/people";
import type { CurrentUser } from "@/server/session";
import {
  completeMyTask,
  createTask,
  getMyTask,
  getTask,
  listMyTasks,
  listTasks,
  reopenTask,
  setTaskArchived,
  startMyTask,
  updateTask,
} from "@/server/tasks";
import { addMember, createTeam, listTeams, removeMember, searchUsers, setTeamManager } from "@/server/teams";

type Role = "ADMIN" | "MANAGER" | "MEMBER";

async function makeUser(name: string, role: Role): Promise<CurrentUser> {
  const username = `${name.toLowerCase().replace(/\s+/g, "")}${randomUUID().slice(0, 6)}`;
  return prisma.user.create({
    data: { id: randomUUID(), name, email: `${username}@test.local`, username, role },
    select: { id: true, name: true, email: true, username: true, image: true, role: true },
  });
}

/** Re-reads someone's role, as the session does on every request. */
async function fresh(user: CurrentUser): Promise<CurrentUser> {
  return prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { id: true, name: true, email: true, username: true, image: true, role: true },
  });
}

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

let owner: CurrentUser;
let mia: CurrentUser; // manages Tech
let noah: CurrentUser; // manages Business
let alice: CurrentUser; // Tech
let bob: CurrentUser; // Tech
let carol: CurrentUser; // Business
let olivia: CurrentUser; // on no team
let tech: string;
let business: string;

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
  owner = await makeUser("Owen Owner", "ADMIN");
  mia = await makeUser("Mia Manager", "MANAGER");
  noah = await makeUser("Noah Manager", "MANAGER");
  alice = await makeUser("Alice Member", "MEMBER");
  bob = await makeUser("Bob Member", "MEMBER");
  carol = await makeUser("Carol Member", "MEMBER");
  olivia = await makeUser("Olivia Member", "MEMBER");

  tech = (
    await prisma.team.create({
      data: { name: "Tech", managerId: mia.id, members: { create: [{ userId: alice.id }, { userId: bob.id }] } },
    })
  ).id;
  business = (
    await prisma.team.create({
      data: { name: "Business", managerId: noah.id, members: { create: [{ userId: carol.id }] } },
    })
  ).id;
});

afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

const newTask = (assigneeId: string, teamId: string) => ({
  title: "Write the quarterly report",
  description: "Numbers and commentary",
  priority: "HIGH" as const,
  dueAt: inDays(3),
  assigneeId,
  teamId,
});

describe("the owner sees and controls everything", () => {
  it("can assign work to a manager or straight to an employee, in any team", async () => {
    const toManager = await createTask(owner, newTask(mia.id, tech));
    const toEmployee = await createTask(owner, newTask(carol.id, business));
    expect(toManager.assigneeId).toBe(mia.id);
    expect(toEmployee.teamId).toBe(business);
    const activity = await prisma.taskActivity.findMany({ where: { taskId: toManager.id } });
    expect(activity.map((a) => a.type)).toEqual(["CREATED"]);
  });

  it("sees every team's tasks, including the ones managers created", async () => {
    await createTask(owner, newTask(mia.id, tech));
    await createTask(noah, newTask(carol.id, business));
    expect(await listTasks(owner)).toHaveLength(2);
    expect(await listTeams(owner)).toHaveLength(2);
  });

  it("can edit tasks a manager created", async () => {
    const task = await createTask(mia, newTask(alice.id, tech));
    await updateTask(owner, task.id, { ...newTask(bob.id, tech), title: "Owner changed this" });
    const updated = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated.title).toBe("Owner changed this");
    expect(updated.assigneeId).toBe(bob.id);
  });

  it("still can't assign a task to someone outside the chosen team", async () => {
    await expect(createTask(owner, newTask(carol.id, tech))).rejects.toThrow(DomainError);
    await expect(createTask(owner, newTask(olivia.id, tech))).rejects.toThrow(DomainError);
    // The owner is never an assignee.
    await expect(createTask(owner, newTask(owner.id, tech))).rejects.toThrow(DomainError);
  });
});

describe("a manager is limited to their own teams", () => {
  it("can assign within their team, to employees or themself", async () => {
    await createTask(mia, newTask(alice.id, tech));
    await createTask(mia, newTask(mia.id, tech));
    expect(await listTasks(mia)).toHaveLength(2);
  });

  it("can't assign in another team or to another team's employee", async () => {
    await expect(createTask(mia, newTask(carol.id, business))).rejects.toThrow(DomainError);
    await expect(createTask(mia, newTask(carol.id, tech))).rejects.toThrow(DomainError);
  });

  it("can't see or change another team's tasks", async () => {
    const task = await createTask(noah, newTask(carol.id, business));
    await expect(getTask(mia, task.id)).rejects.toThrow();
    await expect(updateTask(mia, task.id, newTask(alice.id, tech))).rejects.toThrow(DomainError);
    await expect(setTaskArchived(mia, task.id, true)).rejects.toThrow(DomainError);
    expect(await listTasks(mia)).toHaveLength(0);
    expect((await listTeams(mia)).map((t) => t.name)).toEqual(["Tech"]);
  });

  it("can't edit, reassign or archive work the owner assigned, but can follow it", async () => {
    const task = await createTask(owner, newTask(alice.id, tech));
    expect((await getTask(mia, task.id)).id).toBe(task.id);
    await expect(updateTask(mia, task.id, newTask(bob.id, tech))).rejects.toThrow(DomainError);
    await expect(setTaskArchived(mia, task.id, true)).rejects.toThrow(DomainError);
  });

  it("only sees their own teams in analytics", async () => {
    await createTask(mia, newTask(alice.id, tech));
    await createTask(noah, newTask(carol.id, business));
    const analytics = (await getTeamAnalytics(mia))!;
    expect(analytics.team.total).toBe(1);
    expect(analytics.teams.map((t) => t.name)).toEqual(["Tech"]);
    expect(analytics.members.map((m) => m.user.name).sort()).toEqual(["Alice Member", "Bob Member", "Mia Manager"]);
  });
});

describe("delegation with subtasks", () => {
  it("a manager splits the owner's task into subtasks for their employees", async () => {
    const parent = await createTask(owner, newTask(mia.id, tech));
    const sub = await createTask(mia, { ...newTask(alice.id, tech), title: "Gather the numbers", parentId: parent.id });

    expect(sub.parentId).toBe(parent.id);
    expect(sub.teamId).toBe(tech);
    const parentLog = await prisma.taskActivity.findMany({ where: { taskId: parent.id } });
    expect(parentLog.map((a) => a.type)).toContain("SUBTASK_ADDED");

    // The owner sees the subtask under the main task; Alice sees it as her own work.
    const seen = await getTask(owner, parent.id);
    expect(seen.subtasks.map((s) => s.id)).toEqual([sub.id]);
    expect((await listMyTasks(alice)).map((t) => t.id)).toEqual([sub.id]);
  });

  it("subtasks stay in the parent's team and are only one level deep", async () => {
    const parent = await createTask(owner, newTask(mia.id, tech));
    // teamId in the input is ignored: the subtask goes to the parent's team.
    await expect(
      createTask(mia, { ...newTask(carol.id, business), parentId: parent.id }),
    ).rejects.toThrow(DomainError);
    const sub = await createTask(mia, { ...newTask(alice.id, tech), parentId: parent.id });
    await expect(createTask(mia, { ...newTask(bob.id, tech), parentId: sub.id })).rejects.toThrow(DomainError);
  });

  it("another team's manager and employees can't add subtasks", async () => {
    const parent = await createTask(owner, newTask(mia.id, tech));
    await expect(createTask(noah, { ...newTask(carol.id, business), parentId: parent.id })).rejects.toThrow(
      DomainError,
    );
  });

  it("archiving the main task archives its open subtasks too", async () => {
    const parent = await createTask(owner, newTask(mia.id, tech));
    const sub = await createTask(mia, { ...newTask(alice.id, tech), parentId: parent.id });
    await setTaskArchived(owner, parent.id, true);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: sub.id } })).archivedAt).not.toBeNull();
    expect(await listMyTasks(alice)).toHaveLength(0);
  });
});

describe("working on your own tasks", () => {
  it("a manager can start and complete work the owner gave them", async () => {
    const task = await createTask(owner, newTask(mia.id, tech));
    expect((await listMyTasks(mia)).map((t) => t.id)).toEqual([task.id]);
    await startMyTask(mia, task.id);
    await completeMyTask(mia, task.id, "Delivered to the owner.");
    const done = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(done.status).toBe("COMPLETED");
  });

  it("an employee sees only their own tasks", async () => {
    await createTask(mia, newTask(alice.id, tech));
    await createTask(mia, newTask(bob.id, tech));
    const mine = await listMyTasks(alice);
    expect(mine).toHaveLength(1);
    expect(mine.every((t) => t.assignee.id === alice.id)).toBe(true);
  });

  it("an employee cannot open or update someone else's task", async () => {
    const bobsTask = await createTask(mia, newTask(bob.id, tech));
    await expect(getMyTask(alice, bobsTask.id)).rejects.toThrow();
    await expect(startMyTask(alice, bobsTask.id)).rejects.toThrow(DomainError);
    await expect(completeMyTask(alice, bobsTask.id, "done it")).rejects.toThrow(DomainError);
    const unchanged = await prisma.task.findUniqueOrThrow({ where: { id: bobsTask.id } });
    expect(unchanged.status).toBe("PENDING");
  });

  it("someone removed from the team loses access to its tasks, history is kept", async () => {
    const task = await createTask(mia, newTask(alice.id, tech));
    await removeMember(mia, tech, alice.id);
    expect(await listMyTasks(alice)).toHaveLength(0);
    await expect(startMyTask(alice, task.id)).rejects.toThrow(DomainError);
    expect(await prisma.task.count({ where: { id: task.id } })).toBe(1);
  });

  it("archived tasks are hidden from the assignee", async () => {
    const task = await createTask(mia, newTask(alice.id, tech));
    await setTaskArchived(mia, task.id, true);
    expect(await listMyTasks(alice)).toHaveLength(0);
    await expect(startMyTask(alice, task.id)).rejects.toThrow(DomainError);
  });
});

describe("status workflow", () => {
  it("records server-side timestamps and activity for start and completion", async () => {
    const task = await createTask(mia, newTask(alice.id, tech));
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
  });

  it("an assignee cannot complete twice or move a completed task back", async () => {
    const task = await createTask(mia, newTask(alice.id, tech));
    await completeMyTask(alice, task.id, "All done here.");
    await expect(completeMyTask(alice, task.id, "Again")).rejects.toThrow(DomainError);
    await expect(startMyTask(alice, task.id)).rejects.toThrow(DomainError);
  });

  it("reassigning resets progress, stays within the team and is logged", async () => {
    const task = await createTask(mia, newTask(alice.id, tech));
    await startMyTask(alice, task.id);
    await expect(updateTask(mia, task.id, newTask(carol.id, tech))).rejects.toThrow(DomainError);
    await updateTask(mia, task.id, newTask(bob.id, tech));
    const updated = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated.assigneeId).toBe(bob.id);
    expect(updated.status).toBe("PENDING");
    expect(updated.startedAt).toBeNull();
    const types = (await prisma.taskActivity.findMany({ where: { taskId: task.id } })).map((a) => a.type);
    expect(types).toContain("REASSIGNED");
  });

  it("only completed tasks can be reopened, by a lead of that team, and the reason is logged", async () => {
    const task = await createTask(mia, newTask(alice.id, tech));
    await expect(reopenTask(mia, task.id, "Not finished yet")).rejects.toThrow(DomainError);
    await startMyTask(alice, task.id);
    await completeMyTask(alice, task.id, "Finished the work.");
    await expect(reopenTask(noah, task.id, "Not my team")).rejects.toThrow(DomainError);

    await reopenTask(mia, task.id, "Missing the appendix");
    const reopened = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(reopened.status).toBe("IN_PROGRESS");
    expect(reopened.completedAt).toBeNull();
    const log = await prisma.taskActivity.findFirstOrThrow({ where: { taskId: task.id, type: "REOPENED" } });
    expect(log.details).toMatchObject({ reason: "Missing the appendix", previousCompletionNote: "Finished the work." });
  });
});

describe("teams and people", () => {
  it("a manager can create their own team and becomes its manager", async () => {
    const team = await createTeam(mia, { name: "Design", description: "", managerId: noah.id });
    expect(team.managerId).toBe(mia.id);
    expect((await listTeams(mia)).map((t) => t.name).sort()).toEqual(["Design", "Tech"]);
  });

  it("the owner can create a team for a manager, but not for an employee", async () => {
    const team = await createTeam(owner, { name: "Sales", description: "", managerId: noah.id });
    expect(team.managerId).toBe(noah.id);
    await expect(createTeam(owner, { name: "Ops", description: "", managerId: alice.id })).rejects.toThrow(
      DomainError,
    );
  });

  it("search finds employees only, never managers, the owner or emails", async () => {
    const results = await searchUsers(mia, tech, "member");
    expect(results.map((r) => r.name).sort()).toEqual(["Alice Member", "Bob Member", "Carol Member", "Olivia Member"]);
    expect(results.find((r) => r.name === "Alice Member")!.inTeam).toBe(true);
    // A manager doesn't learn the name of another team.
    expect(results.find((r) => r.name === "Carol Member")!.otherTeam).toBe("another team");
    expect(results.every((r) => !("email" in r))).toBe(true);
    expect(await searchUsers(mia, tech, "manager")).toHaveLength(0);
  });

  it("an employee is on one team: a manager can't take someone from another team", async () => {
    await expect(addMember(mia, tech, carol.id)).rejects.toThrow(DomainError);
    await addMember(mia, tech, olivia.id);
    await addMember(mia, tech, olivia.id); // idempotent
    expect(await prisma.teamMember.count({ where: { userId: olivia.id } })).toBe(1);
  });

  it("the owner can move an employee between teams", async () => {
    await addMember(owner, tech, carol.id);
    const memberships = await prisma.teamMember.findMany({ where: { userId: carol.id } });
    expect(memberships.map((m) => m.teamId)).toEqual([tech]);
  });

  it("a manager can't add people to a team they don't run", async () => {
    await expect(addMember(mia, business, olivia.id)).rejects.toThrow(DomainError);
  });

  it("managers and the owner can't be added as employees", async () => {
    await expect(addMember(owner, tech, noah.id)).rejects.toThrow(DomainError);
    await expect(addMember(mia, tech, owner.id)).rejects.toThrow(DomainError);
  });

  it("promoting an employee to manager takes them off the employee list", async () => {
    await setRole(owner, alice.id, "MANAGER");
    expect((await fresh(alice)).role).toBe("MANAGER");
    expect(await prisma.teamMember.count({ where: { userId: alice.id } })).toBe(0);
  });

  it("a manager still running a team can't be made an employee", async () => {
    await expect(setRole(owner, mia.id, "MEMBER")).rejects.toThrow(DomainError);
    await setTeamManager(owner, tech, noah.id);
    await setRole(owner, mia.id, "MEMBER");
    expect((await fresh(mia)).role).toBe("MEMBER");
  });

  it("the owner can promote one of a team's employees to be its manager", async () => {
    await setTeamManager(owner, tech, bob.id);
    const team = await prisma.team.findUniqueOrThrow({ where: { id: tech }, include: { members: true } });
    expect(team.managerId).toBe(bob.id);
    expect(team.members.map((m) => m.userId)).toEqual([alice.id]);
    expect((await fresh(bob)).role).toBe("MANAGER");
    // …and an employee of another team can't be made manager here.
    await expect(setTeamManager(owner, business, alice.id)).rejects.toThrow(DomainError);
  });

  it("only the owner changes roles and managers, and never their own role", async () => {
    await expect(setRole(mia, alice.id, "MANAGER")).rejects.toThrow(DomainError);
    await expect(setTeamManager(mia, tech, noah.id)).rejects.toThrow(DomainError);
    await expect(setRole(owner, owner.id, "MEMBER")).rejects.toThrow(DomainError);
  });
});
