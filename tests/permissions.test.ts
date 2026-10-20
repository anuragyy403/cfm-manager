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
import { deleteEmployee, getPersonOverview, setRole } from "@/server/people";
import type { CurrentUser } from "@/server/session";
import {
  createTask,
  createTeamTasks,
  deleteTask,
  getMyTask,
  getTask,
  listMyTasks,
  listReviewQueue,
  listTasks,
  reopenTask,
  reviewTask,
  setTaskArchived,
  startMyTask,
  submitMyTask,
  updateTask,
} from "@/server/tasks";
import { addMember, createTeam, deleteTeam, getMyTeam, listTeams, removeMember, searchUsers, setTeamManager } from "@/server/teams";

type Role = "ADMIN" | "HR" | "MANAGER" | "MEMBER";

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
  it("a manager can start and hand in work the owner gave them, and the owner passes it", async () => {
    const task = await createTask(owner, newTask(mia.id, tech));
    expect((await listMyTasks(mia)).map((t) => t.id)).toEqual([task.id]);
    await startMyTask(mia, task.id);
    await submitMyTask(mia, task.id, "Delivered to the owner.");
    await reviewTask(owner, task.id, "PASS", null);
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
    await expect(submitMyTask(alice, bobsTask.id, "done it")).rejects.toThrow(DomainError);
    const unchanged = await prisma.task.findUniqueOrThrow({ where: { id: bobsTask.id } });
    expect(unchanged.status).toBe("PENDING");
  });

  it("someone removed from the team still sees its tasks but can't work on them", async () => {
    const task = await createTask(mia, newTask(alice.id, tech));
    await removeMember(mia, tech, alice.id);
    expect(await listMyTasks(alice)).toHaveLength(1);
    expect((await getMyTask(alice, task.id)).onMyTeam).toBe(false);
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
  it("records server-side timestamps and activity for start, hand-in and pass", async () => {
    const task = await createTask(mia, newTask(alice.id, tech));
    const before = Date.now();
    await startMyTask(alice, task.id);
    await submitMyTask(alice, task.id, "Report sent to the client.");
    await reviewTask(mia, task.id, "PASS", null);
    const done = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });

    expect(done.status).toBe("COMPLETED");
    expect(done.startedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(done.submittedAt!.getTime()).toBeGreaterThanOrEqual(done.startedAt!.getTime());
    expect(done.completedAt!.getTime()).toBeGreaterThanOrEqual(done.submittedAt!.getTime());
    expect(done.completionNote).toBe("Report sent to the client.");

    const activity = await prisma.taskActivity.findMany({ where: { taskId: task.id }, orderBy: { createdAt: "asc" } });
    expect(activity.map((a) => a.type)).toEqual(["CREATED", "STARTED", "SUBMITTED", "PASSED"]);
  });

  it("an assignee cannot hand in twice or move handed-in or passed work back", async () => {
    const task = await createTask(mia, newTask(alice.id, tech));
    await submitMyTask(alice, task.id, "All done here.");
    await expect(submitMyTask(alice, task.id, "Again")).rejects.toThrow(DomainError);
    await expect(startMyTask(alice, task.id)).rejects.toThrow(DomainError);
    await reviewTask(mia, task.id, "PASS", null);
    await expect(submitMyTask(alice, task.id, "Again")).rejects.toThrow(DomainError);
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
    await submitMyTask(alice, task.id, "Finished the work.");
    await expect(reopenTask(mia, task.id, "Still in review")).rejects.toThrow(DomainError);
    await reviewTask(mia, task.id, "PASS", null);
    await expect(reopenTask(noah, task.id, "Not my team")).rejects.toThrow(DomainError);

    await reopenTask(mia, task.id, "Missing the appendix");
    const reopened = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(reopened.status).toBe("IN_PROGRESS");
    expect(reopened.completedAt).toBeNull();
    // The reason is what the assignee sees as the change to make.
    expect(reopened.reviewNote).toBe("Missing the appendix");
    const log = await prisma.taskActivity.findFirstOrThrow({ where: { taskId: task.id, type: "REOPENED" } });
    expect(log.details).toMatchObject({ reason: "Missing the appendix", previousCompletionNote: "Finished the work." });
  });
});

describe("manager review", () => {
  it("handed-in work is in review, not done, until the manager passes it", async () => {
    const task = await createTask(mia, newTask(alice.id, tech));
    await submitMyTask(alice, task.id, "Landing page is live on staging.");

    const inReview = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(inReview.status).toBe("SUBMITTED");
    expect(inReview.submittedAt).not.toBeNull();
    expect(inReview.completedAt).toBeNull();
    expect((await getTeamAnalytics(mia))!.team).toMatchObject({ completed: 0, inReview: 1 });
    expect((await listReviewQueue(mia)).map((t) => t.id)).toEqual([task.id]);

    await reviewTask(mia, task.id, "PASS", "Exactly what we needed.");
    const passed = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(passed.status).toBe("COMPLETED");
    expect(passed.completedAt).not.toBeNull();
    expect(passed.reviewNote).toBe("Exactly what we needed.");
    expect((await getTeamAnalytics(mia))!.team).toMatchObject({ completed: 1, inReview: 0, passedFirstTime: 1 });
    expect(await listReviewQueue(mia)).toHaveLength(0);
  });

  it("failing needs feedback, sends it back, and the assignee resubmits until it passes", async () => {
    const task = await createTask(mia, newTask(alice.id, tech));
    await submitMyTask(alice, task.id, "First try at the report.");
    await expect(reviewTask(mia, task.id, "FAIL", null)).rejects.toThrow(DomainError);

    await reviewTask(mia, task.id, "FAIL", "The Q3 numbers are missing.");
    const sentBack = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(sentBack.status).toBe("IN_PROGRESS");
    expect(sentBack.reviewNote).toBe("The Q3 numbers are missing.");
    expect(sentBack.timesFailed).toBe(1);
    expect(sentBack.startedAt).not.toBeNull();
    expect((await listMyTasks(alice)).map((t) => t.status)).toEqual(["IN_PROGRESS"]);

    await submitMyTask(alice, task.id, "Added the Q3 numbers.");
    const resubmitted = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(resubmitted.status).toBe("SUBMITTED");
    expect(resubmitted.reviewNote).toBeNull();

    await reviewTask(mia, task.id, "PASS", null);
    const activity = await prisma.taskActivity.findMany({ where: { taskId: task.id }, orderBy: { createdAt: "asc" } });
    expect(activity.map((a) => a.type)).toEqual(["CREATED", "SUBMITTED", "FAILED", "SUBMITTED", "PASSED"]);
    expect(activity[2]!.details).toMatchObject({ note: "The Q3 numbers are missing." });
    expect((await getTeamAnalytics(mia))!.team).toMatchObject({ completed: 1, passedFirstTime: 0 });
  });

  it("only the team's manager or the owner can review, and nobody reviews their own work", async () => {
    const task = await createTask(mia, newTask(alice.id, tech));
    await submitMyTask(alice, task.id, "Done, please check.");
    await expect(reviewTask(noah, task.id, "PASS", null)).rejects.toThrow(DomainError); // other team's manager
    await expect(reviewTask(bob, task.id, "PASS", null)).rejects.toThrow(DomainError); // a teammate
    await expect(reviewTask(alice, task.id, "PASS", null)).rejects.toThrow(DomainError); // herself
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("SUBMITTED");

    await reviewTask(owner, task.id, "PASS", null); // the owner may review anything
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("COMPLETED");
  });

  it("a manager's own work goes to the owner for review", async () => {
    const fromOwner = await createTask(owner, newTask(mia.id, tech));
    const fromHerself = await createTask(mia, newTask(mia.id, tech));
    await submitMyTask(mia, fromOwner.id, "Portal is ready.");
    await submitMyTask(mia, fromHerself.id, "Wrote the docs.");

    await expect(reviewTask(mia, fromOwner.id, "PASS", null)).rejects.toThrow(DomainError);
    await expect(reviewTask(mia, fromHerself.id, "PASS", null)).rejects.toThrow(DomainError);
    expect(await listReviewQueue(mia)).toHaveLength(0);
    expect((await listReviewQueue(owner)).map((t) => t.id).sort()).toEqual([fromOwner.id, fromHerself.id].sort());

    await reviewTask(owner, fromOwner.id, "FAIL", "Login doesn't work on mobile.");
    expect((await prisma.task.findUniqueOrThrow({ where: { id: fromOwner.id } })).status).toBe("IN_PROGRESS");
  });

  it("an employee's work goes to their manager, even when the owner assigned it", async () => {
    const task = await createTask(owner, newTask(alice.id, tech));
    await submitMyTask(alice, task.id, "Lease papers signed.");
    expect((await listReviewQueue(mia)).map((t) => t.id)).toEqual([task.id]);
    expect(await listReviewQueue(owner)).toHaveLength(0);
    await reviewTask(mia, task.id, "PASS", null);
  });

  it("only work waiting for review can be reviewed", async () => {
    const task = await createTask(mia, newTask(alice.id, tech));
    await expect(reviewTask(mia, task.id, "PASS", null)).rejects.toThrow(DomainError);
    await submitMyTask(alice, task.id, "Ready.");
    await reviewTask(mia, task.id, "PASS", null);
    await expect(reviewTask(mia, task.id, "FAIL", "Changed my mind")).rejects.toThrow(DomainError);
  });

  it("work handed in by the deadline is on time and never overdue, however long the review takes", async () => {
    const task = await createTask(mia, newTask(alice.id, tech));
    await submitMyTask(alice, task.id, "Delivered.");
    // The deadline passes while it waits for review.
    await prisma.task.update({ where: { id: task.id }, data: { dueAt: new Date(Date.now() - 60_000), submittedAt: new Date(Date.now() - 120_000) } });
    expect(await listTasks(mia, { view: "OVERDUE" })).toHaveLength(0);

    await reviewTask(mia, task.id, "PASS", null);
    expect((await getTeamAnalytics(mia))!.team).toMatchObject({ completed: 1, completedOnTime: 1, overdue: 0 });
  });
});

describe("a person's record across teams", () => {
  it("moving to another team keeps the work done before, once per person", async () => {
    const before = await createTask(mia, newTask(alice.id, tech));
    await submitMyTask(alice, before.id, "Delivered in Tech.");
    await reviewTask(mia, before.id, "PASS", null);

    await addMember(owner, business, alice.id); // the owner moves Alice to Business
    await createTask(noah, newTask(alice.id, business));

    // Owner: one row for Alice with both tasks, wherever she is now.
    const ownerPeople = (await getTeamAnalytics(owner))!.people.filter((p) => p.user.id === alice.id);
    expect(ownerPeople).toHaveLength(1);
    expect(ownerPeople[0]!.metrics).toMatchObject({ total: 2, completed: 1 });
    expect(ownerPeople[0]!.currentTeams).toEqual(["Business"]);

    // Tech's manager still sees what she did in Tech, as a former member.
    const inTech = (await getTeamAnalytics(mia))!.people.find((p) => p.user.id === alice.id)!;
    expect(inTech.metrics).toMatchObject({ total: 1, completed: 1 });
    expect(inTech.currentTeams).toEqual([]);

    // Business's manager sees only Business work.
    const inBusiness = (await getTeamAnalytics(noah))!.people.find((p) => p.user.id === alice.id)!;
    expect(inBusiness.metrics).toMatchObject({ total: 1, completed: 0 });
  });

  it("after a move the employee still sees all their own tasks, and can open old ones", async () => {
    const before = await createTask(mia, newTask(alice.id, tech));
    await addMember(owner, business, alice.id);
    const now = await createTask(noah, newTask(alice.id, business));

    expect((await listMyTasks(alice)).map((t) => t.id).sort()).toEqual([before.id, now.id].sort());
    expect((await getMyTask(alice, before.id)).onMyTeam).toBe(false);
    expect((await getMyTask(alice, now.id)).onMyTeam).toBe(true);
    // Old-team work is read only; the new team's work can be done.
    await expect(startMyTask(alice, before.id)).rejects.toThrow(DomainError);
    await startMyTask(alice, now.id);
  });

  it("a person's new manager sees their whole record on their profile, read only", async () => {
    const before = await createTask(mia, newTask(alice.id, tech));
    await addMember(owner, business, alice.id);
    await createTask(noah, newTask(alice.id, business));

    const profile = await getPersonOverview(noah, alice.id);
    expect(profile.tasks).toHaveLength(2);
    expect((await getTask(noah, before.id)).id).toBe(before.id);
    await expect(setTaskArchived(noah, before.id, true)).rejects.toThrow(DomainError);

    // The old manager keeps only the work done on their team.
    expect((await getPersonOverview(mia, alice.id)).tasks).toHaveLength(1);
  });

  it("a promoted employee keeps seeing the tasks they had as an employee", async () => {
    await createTask(mia, newTask(alice.id, tech));
    await setRole(owner, alice.id, "MANAGER");
    expect(await listMyTasks(await fresh(alice))).toHaveLength(1);
  });
});

describe("my team and whole-team tasks", () => {
  it("an employee sees their team, its manager and its members", async () => {
    const team = await getMyTeam(alice);
    expect(team?.name).toBe("Tech");
    expect(team?.manager.id).toBe(mia.id);
    expect(team?.members.map((m) => m.user.id).sort()).toEqual([alice.id, bob.id].sort());
    expect(await getMyTeam(olivia)).toBeNull();
  });

  it("a whole-team task gives every employee their own copy", async () => {
    const { assigneeId: _, ...input } = newTask(alice.id, tech);
    const ids = await createTeamTasks(mia, input);
    expect(ids).toHaveLength(2);
    expect(await listMyTasks(alice)).toHaveLength(1);
    expect(await listMyTasks(bob)).toHaveLength(1);
    // A manager can't send one to someone else's team.
    await expect(createTeamTasks(mia, { ...input, teamId: business })).rejects.toThrow(DomainError);
  });
});

describe("deleting tasks", () => {
  it("only the owner can delete a task, and its subtasks and history go with it", async () => {
    const hr = await makeUser("Hana HR", "HR");
    const parent = await createTask(owner, newTask(mia.id, tech));
    const sub = await createTask(mia, { ...newTask(alice.id, tech), parentId: parent.id });
    await submitMyTask(alice, sub.id, "Done.");

    await expect(deleteTask(mia, parent.id)).rejects.toThrow(DomainError); // the team's manager
    await expect(deleteTask(hr, parent.id)).rejects.toThrow(DomainError); // HR archives, never deletes
    await expect(deleteTask(alice, sub.id)).rejects.toThrow(DomainError); // the assignee
    expect(await prisma.task.count({ where: { id: { in: [parent.id, sub.id] } } })).toBe(2);

    await deleteTask(owner, parent.id);
    expect(await prisma.task.count({ where: { id: { in: [parent.id, sub.id] } } })).toBe(0);
    expect(await prisma.taskActivity.count({ where: { taskId: { in: [parent.id, sub.id] } } })).toBe(0);
  });

  it("deleting a subtask leaves the main task", async () => {
    const parent = await createTask(mia, newTask(mia.id, tech));
    const sub = await createTask(mia, { ...newTask(alice.id, tech), parentId: parent.id });
    expect(await deleteTask(owner, sub.id)).toEqual({ parentId: parent.id });
    expect(await prisma.task.count({ where: { id: parent.id } })).toBe(1);
  });
});

describe("deleting employees and teams", () => {
  it("only the owner deletes an employee: account, sign-in and their tasks go; others' subtasks stay", async () => {
    const theirs = await createTask(mia, newTask(alice.id, tech));
    const bobsPart = await createTask(mia, { ...newTask(bob.id, tech), parentId: theirs.id });
    await submitMyTask(alice, theirs.id, "Done.");
    await prisma.session.create({
      data: { id: randomUUID(), token: randomUUID(), userId: alice.id, expiresAt: new Date(Date.now() + 864e5) },
    });

    await expect(deleteEmployee(mia, alice.id)).rejects.toThrow(DomainError); // a manager
    await expect(deleteEmployee(owner, mia.id)).rejects.toThrow(DomainError); // not an employee
    await expect(deleteEmployee(owner, owner.id)).rejects.toThrow(DomainError);

    expect(await deleteEmployee(owner, alice.id)).toEqual({ name: alice.name, deletedTasks: 1 });
    expect(await prisma.user.count({ where: { id: alice.id } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: alice.id } })).toBe(0);
    expect(await prisma.task.count({ where: { id: theirs.id } })).toBe(0);
    expect(await prisma.taskActivity.count({ where: { taskId: theirs.id } })).toBe(0);
    const kept = await prisma.task.findUniqueOrThrow({ where: { id: bobsPart.id } });
    expect(kept.parentId).toBeNull();
  });

  it("won't delete someone whose actions are part of other people's task history", async () => {
    const alicesTask = await createTask(mia, newTask(alice.id, tech));
    await prisma.taskActivity.create({ data: { taskId: alicesTask.id, actorId: bob.id, type: "UPDATED" } });
    await expect(deleteEmployee(owner, bob.id)).rejects.toThrow(DomainError);
    expect(await prisma.user.count({ where: { id: bob.id } })).toBe(1);
  });

  it("only the owner deletes a team; its tasks move to another team first so records stay", async () => {
    const work = await createTask(mia, newTask(alice.id, tech));
    await submitMyTask(alice, work.id, "Done.");
    await reviewTask(mia, work.id, "PASS", null);

    await expect(deleteTeam(mia, tech, business)).rejects.toThrow(DomainError);
    await expect(deleteTeam(owner, tech, null)).rejects.toThrow(DomainError); // has tasks: needs a target
    await expect(deleteTeam(owner, tech, tech)).rejects.toThrow(DomainError);

    expect(await deleteTeam(owner, tech, business)).toMatchObject({ movedTasks: 1, movedTo: "Business", employees: 2 });
    expect(await prisma.team.count({ where: { id: tech } })).toBe(0);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: work.id } })).teamId).toBe(business);
    expect(await prisma.teamMember.count({ where: { userId: alice.id } })).toBe(0); // now without a team
    expect(await prisma.user.count({ where: { id: alice.id } })).toBe(1); // account stays
    // Her record still counts the work.
    const record = (await getTeamAnalytics(owner))!.people.find((p) => p.user.id === alice.id)!;
    expect(record.metrics).toMatchObject({ total: 1, completed: 1 });
  });

  it("a team with no tasks is deleted straight away", async () => {
    const design = await createTeam(owner, { name: "Design", description: "", managerId: noah.id });
    expect(await deleteTeam(owner, design.id, null)).toMatchObject({ movedTasks: 0, movedTo: null });
  });
});

describe("HR", () => {
  let hr: CurrentUser;
  let hrTeam: string;
  beforeEach(async () => {
    hr = await makeUser("Hana HR", "HR");
    // The owner gives HR work through the HR team, which HR heads.
    hrTeam = (await prisma.team.create({ data: { name: "HR", managerId: hr.id } })).id;
  });

  it("sees every team and assigns to employees and managers in any of them", async () => {
    expect((await listTeams(hr)).map((t) => t.name).sort()).toEqual(["Business", "HR", "Tech"]);
    await createTask(hr, newTask(alice.id, tech));
    await createTask(hr, newTask(carol.id, business));
    await createTask(hr, newTask(noah.id, business)); // a manager
    await expect(createTask(hr, newTask(olivia.id, tech))).rejects.toThrow(DomainError); // not on the team
  });

  it("only the owner gives work to HR", async () => {
    await expect(createTask(hr, newTask(hr.id, hrTeam))).rejects.toThrow(DomainError);
    await expect(createTask(mia, newTask(hr.id, hrTeam))).rejects.toThrow(DomainError);
    const fromOwner = await createTask(owner, newTask(hr.id, hrTeam));
    expect((await listMyTasks(hr)).map((t) => t.id)).toEqual([fromOwner.id]);
  });

  it("can't change teams: those stay with the owner", async () => {
    await expect(createTeam(hr, { name: "Design", description: "" })).rejects.toThrow(DomainError);
    await expect(addMember(hr, tech, olivia.id)).rejects.toThrow(DomainError);
    await expect(removeMember(hr, tech, alice.id)).rejects.toThrow(DomainError);
    await expect(setTeamManager(hr, tech, noah.id)).rejects.toThrow(DomainError);
    await expect(setRole(hr, bob.id, "MANAGER")).rejects.toThrow(DomainError);
  });

  it("manages any team's tasks except the owner's, and managers can't change HR's tasks", async () => {
    const fromHR = await createTask(hr, newTask(alice.id, tech));
    const fromOwner = await createTask(owner, newTask(bob.id, tech));
    const fromManager = await createTask(mia, newTask(bob.id, tech));

    await expect(updateTask(mia, fromHR.id, { ...newTask(bob.id, tech), title: "Changed" })).rejects.toThrow(DomainError);
    await expect(setTaskArchived(mia, fromHR.id, true)).rejects.toThrow(DomainError);
    // The manager can still split HR's task among the team.
    await createTask(mia, { ...newTask(bob.id, tech), parentId: fromHR.id });

    await expect(updateTask(hr, fromOwner.id, { ...newTask(alice.id, tech), title: "Changed" })).rejects.toThrow(DomainError);
    await updateTask(hr, fromManager.id, { ...newTask(alice.id, tech), title: "HR changed this" });
    expect((await prisma.task.findUniqueOrThrow({ where: { id: fromManager.id } })).assigneeId).toBe(alice.id);
  });

  it("reviews any team's work; HR's own work goes to the owner", async () => {
    const work = await createTask(mia, newTask(alice.id, tech));
    await submitMyTask(alice, work.id, "Done.");
    await reviewTask(hr, work.id, "PASS", null);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: work.id } })).status).toBe("COMPLETED");

    const given = await createTask(hr, newTask(carol.id, business));
    await submitMyTask(carol, given.id, "Done.");
    expect((await listReviewQueue(hr)).map((t) => t.id)).toEqual([given.id]);

    const own = await createTask(owner, newTask(hr.id, hrTeam));
    await submitMyTask(hr, own.id, "Policy written.");
    await expect(reviewTask(hr, own.id, "PASS", null)).rejects.toThrow(DomainError);
    expect((await listReviewQueue(owner)).map((t) => t.id)).toContain(own.id);
    await reviewTask(owner, own.id, "PASS", null);
  });

  it("only the owner makes someone HR, and they leave their employee team", async () => {
    await expect(setRole(mia, alice.id, "HR")).rejects.toThrow(DomainError);
    await setRole(owner, alice.id, "HR");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: alice.id } })).role).toBe("HR");
    expect(await prisma.teamMember.count({ where: { userId: alice.id } })).toBe(0);
    // Heading a team: hand it over before becoming an employee.
    await expect(setRole(owner, hr.id, "MEMBER")).rejects.toThrow(DomainError);
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
