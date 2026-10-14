/**
 * Development seed for CFM Workplace.
 *
 * Wipes the local database and creates:
 *   - the owner (admin@cfm.test)
 *   - 2 managers: rahul@cfm.test runs "Tech team", divya@cfm.test runs "Business team"
 *   - 8 employees split across the two teams
 *   - 2 registered employees who are NOT on a team yet (to test search)
 *   - a spread of tasks in every state (pending, in progress, completed on
 *     time, completed late, overdue), plus work the owner gave each manager
 *     that the manager split into subtasks, so every dashboard has data.
 *
 * Every seeded account uses the password in SEED_PASSWORD below.
 * Sign in as admin@cfm.test (owner), rahul@cfm.test (manager) or
 * e.g. aarav@cfm.test (employee).
 *
 * Refuses to run against anything except a local database.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import {
  PrismaClient,
  type TaskPriority,
  type TaskStatus,
} from "../src/generated/prisma/client";

const SEED_PASSWORD = "CfmDev#2026";

const databaseUrl = process.env.DATABASE_URL ?? "";
const host = (() => {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return "";
  }
})();
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  console.error(`Refusing to seed non-local database host "${host}".`);
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const now = Date.now();
const at = (daysFromNow: number, hoursOffset = 0) =>
  new Date(now + daysFromNow * DAY + hoursOffset * HOUR);

type SeedUser = { name: string; username: string; role?: "ADMIN" | "MANAGER" | "MEMBER" };

const admin: SeedUser = { name: "CFM Owner", username: "admin", role: "ADMIN" };

const managers: SeedUser[] = [
  { name: "Rahul Khanna", username: "rahul", role: "MANAGER" },
  { name: "Divya Menon", username: "divya", role: "MANAGER" },
];

/** Which team each employee is on. */
const TEAM_OF: Record<string, "tech" | "business"> = {
  aarav: "tech",
  rohan: "tech",
  vikram: "tech",
  neha: "tech",
  priya: "business",
  ananya: "business",
  sneha: "business",
  karan: "business",
};

const members: SeedUser[] = [
  { name: "Aarav Sharma", username: "aarav" },
  { name: "Priya Patel", username: "priya" },
  { name: "Rohan Mehta", username: "rohan" },
  { name: "Ananya Iyer", username: "ananya" },
  { name: "Vikram Singh", username: "vikram" },
  { name: "Sneha Reddy", username: "sneha" },
  { name: "Karan Gupta", username: "karan" },
  { name: "Neha Verma", username: "neha" },
];

const outsiders: SeedUser[] = [
  { name: "Ishaan Kapoor", username: "ishaan" },
  { name: "Meera Nair", username: "meera" },
];

async function createUser(u: SeedUser, passwordHash: string) {
  const id = randomUUID();
  return prisma.user.create({
    data: {
      id,
      name: u.name,
      email: `${u.username}@cfm.test`,
      emailVerified: true,
      username: u.username,
      displayUsername: u.username,
      role: u.role ?? "MEMBER",
      accounts: {
        create: {
          id: randomUUID(),
          accountId: id,
          providerId: "credential",
          password: passwordHash,
        },
      },
    },
  });
}

type SeedTask = {
  title: string;
  description: string;
  assignee: string; // username
  priority: TaskPriority;
  status: TaskStatus;
  assignedDaysAgo: number;
  dueInDays: number;
  startedDaysAgo?: number;
  completedDaysAgo?: number;
  completionNote?: string;
};

const tasks: SeedTask[] = [
  // Completed on time
  { title: "Develop the Company Landing Page", description: "Build the new marketing landing page with hero, features and contact sections. Must be responsive.", assignee: "aarav", priority: "HIGH", status: "COMPLETED", assignedDaysAgo: 20, dueInDays: -6, startedDaysAgo: 19, completedDaysAgo: 8, completionNote: "Landing page deployed to staging. Lighthouse score 96." },
  { title: "Set up analytics tracking", description: "Add page-view and conversion tracking to the website.", assignee: "aarav", priority: "MEDIUM", status: "COMPLETED", assignedDaysAgo: 14, dueInDays: -3, startedDaysAgo: 12, completedDaysAgo: 5, completionNote: "Tracking live; dashboard shared with marketing." },
  { title: "Prepare Q3 client report", description: "Summarise Q3 deliverables and metrics for the client review.", assignee: "priya", priority: "HIGH", status: "COMPLETED", assignedDaysAgo: 18, dueInDays: -10, startedDaysAgo: 17, completedDaysAgo: 11, completionNote: "Report sent to client and filed in the shared drive." },
  { title: "Update employee handbook", description: "Reflect the new leave policy and remote-work guidelines.", assignee: "ananya", priority: "LOW", status: "COMPLETED", assignedDaysAgo: 25, dueInDays: -12, startedDaysAgo: 22, completedDaysAgo: 13, completionNote: "Handbook v4 published." },
  { title: "Fix checkout payment bug", description: "Customers report a failure when applying discount codes at checkout.", assignee: "rohan", priority: "URGENT", status: "COMPLETED", assignedDaysAgo: 9, dueInDays: -7, startedDaysAgo: 9, completedDaysAgo: 8, completionNote: "Root cause was rounding; patched and verified." },
  { title: "Vendor contract renewal", description: "Review and renew the hosting vendor contract.", assignee: "sneha", priority: "MEDIUM", status: "COMPLETED", assignedDaysAgo: 16, dueInDays: -4, startedDaysAgo: 10, completedDaysAgo: 6, completionNote: "Renewed for 12 months at 8% lower cost." },

  // Completed late
  { title: "Migrate blog to new CMS", description: "Move all existing blog posts and images into the new CMS.", assignee: "vikram", priority: "MEDIUM", status: "COMPLETED", assignedDaysAgo: 21, dueInDays: -9, startedDaysAgo: 18, completedDaysAgo: 4, completionNote: "All 132 posts migrated. Took longer due to broken image links." },
  { title: "Design onboarding email series", description: "Write and design a 4-email onboarding sequence.", assignee: "karan", priority: "LOW", status: "COMPLETED", assignedDaysAgo: 15, dueInDays: -8, startedDaysAgo: 10, completedDaysAgo: 3, completionNote: "Series approved by marketing." },

  // In progress (on track)
  { title: "Build customer feedback form", description: "Create a feedback form linked to the CRM.", assignee: "priya", priority: "MEDIUM", status: "IN_PROGRESS", assignedDaysAgo: 4, dueInDays: 3, startedDaysAgo: 2 },
  { title: "Redesign pricing page", description: "New pricing tiers and comparison table.", assignee: "aarav", priority: "HIGH", status: "IN_PROGRESS", assignedDaysAgo: 3, dueInDays: 1, startedDaysAgo: 1 },
  { title: "Automate weekly sales report", description: "Generate and email the weekly sales report automatically.", assignee: "neha", priority: "MEDIUM", status: "IN_PROGRESS", assignedDaysAgo: 6, dueInDays: 5, startedDaysAgo: 3 },
  { title: "Security audit of admin panel", description: "Review roles, permissions and session handling.", assignee: "rohan", priority: "HIGH", status: "IN_PROGRESS", assignedDaysAgo: 5, dueInDays: 2, startedDaysAgo: 4 },

  // Pending (not started yet)
  { title: "Plan team offsite", description: "Shortlist venues and draft an agenda.", assignee: "ananya", priority: "LOW", status: "PENDING", assignedDaysAgo: 2, dueInDays: 14 },
  { title: "Write API documentation", description: "Document all public endpoints with examples.", assignee: "vikram", priority: "MEDIUM", status: "PENDING", assignedDaysAgo: 1, dueInDays: 7 },
  { title: "Social media content calendar", description: "Plan next month's posts across all channels.", assignee: "karan", priority: "MEDIUM", status: "PENDING", assignedDaysAgo: 1, dueInDays: 1.5 },
  { title: "Interview frontend candidates", description: "Run first-round interviews for the open frontend role.", assignee: "sneha", priority: "HIGH", status: "PENDING", assignedDaysAgo: 2, dueInDays: 6 },

  // Overdue (deadline passed, not completed)
  { title: "Update privacy policy", description: "Align the privacy policy with the new data-retention rules.", assignee: "neha", priority: "HIGH", status: "PENDING", assignedDaysAgo: 10, dueInDays: -2 },
  { title: "Optimise image delivery", description: "Serve images via CDN with modern formats.", assignee: "vikram", priority: "MEDIUM", status: "IN_PROGRESS", assignedDaysAgo: 12, dueInDays: -1, startedDaysAgo: 7 },
  { title: "Quarterly inventory reconciliation", description: "Reconcile stock counts with the accounting system.", assignee: "karan", priority: "URGENT", status: "IN_PROGRESS", assignedDaysAgo: 8, dueInDays: -3, startedDaysAgo: 6 },
];

type Activity = {
  actorId: string;
  type: "CREATED" | "STARTED" | "COMPLETED" | "SUBTASK_ADDED";
  fromStatus?: TaskStatus;
  toStatus?: TaskStatus;
  details?: object;
  createdAt: Date;
};

async function createSeedTask(
  t: SeedTask,
  ids: { teamId: string; assigneeId: string; createdById: string; parentId?: string },
) {
  const assignedAt = at(-t.assignedDaysAgo);
  const startedAt = t.startedDaysAgo !== undefined ? at(-t.startedDaysAgo) : null;
  const completedAt = t.completedDaysAgo !== undefined ? at(-t.completedDaysAgo) : null;

  const activities: Activity[] = [
    { actorId: ids.createdById, type: "CREATED", toStatus: "PENDING", createdAt: assignedAt },
  ];
  if (startedAt) {
    activities.push({ actorId: ids.assigneeId, type: "STARTED", fromStatus: "PENDING", toStatus: "IN_PROGRESS", createdAt: startedAt });
  }
  if (completedAt) {
    activities.push({ actorId: ids.assigneeId, type: "COMPLETED", fromStatus: startedAt ? "IN_PROGRESS" : "PENDING", toStatus: "COMPLETED", createdAt: completedAt });
  }

  const task = await prisma.task.create({
    data: {
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
      dueAt: at(t.dueInDays),
      teamId: ids.teamId,
      parentId: ids.parentId ?? null,
      assigneeId: ids.assigneeId,
      createdById: ids.createdById,
      assignedAt,
      startedAt,
      completedAt,
      completionNote: t.completionNote ?? null,
      createdAt: assignedAt,
      activities: { create: activities },
    },
  });
  if (ids.parentId) {
    await prisma.taskActivity.create({
      data: {
        taskId: ids.parentId,
        actorId: ids.createdById,
        type: "SUBTASK_ADDED",
        details: { subtaskId: task.id, title: task.title, assigneeId: task.assigneeId },
        createdAt: assignedAt,
      },
    });
  }
  return task;
}

/** Work the owner gives each manager, which the manager splits into subtasks. */
const delegated: { team: "tech" | "business"; task: SeedTask; subtasks: SeedTask[] }[] = [
  {
    team: "tech",
    task: { title: "Launch the new client portal", description: "Customers log in to see their reports and invoices. Target: live before the client review.", assignee: "rahul", priority: "HIGH", status: "IN_PROGRESS", assignedDaysAgo: 6, dueInDays: 9, startedDaysAgo: 5 },
    subtasks: [
      { title: "Portal: login and accounts", description: "Email + password login for client users, with password reset.", assignee: "aarav", priority: "HIGH", status: "IN_PROGRESS", assignedDaysAgo: 5, dueInDays: 4, startedDaysAgo: 3 },
      { title: "Portal: reports API", description: "Endpoints for monthly reports and invoices.", assignee: "rohan", priority: "MEDIUM", status: "PENDING", assignedDaysAgo: 5, dueInDays: 6 },
      { title: "Portal: QA test plan", description: "Write the test plan and acceptance checklist.", assignee: "vikram", priority: "MEDIUM", status: "COMPLETED", assignedDaysAgo: 5, dueInDays: 1, startedDaysAgo: 4, completedDaysAgo: 2, completionNote: "Test plan shared in the drive; 42 cases." },
    ],
  },
  {
    team: "business",
    task: { title: "Q4 sales strategy", description: "Targets, pricing and the campaign plan for Q4. Present it at the monthly review.", assignee: "divya", priority: "URGENT", status: "PENDING", assignedDaysAgo: 3, dueInDays: 5 },
    subtasks: [
      { title: "Competitor pricing research", description: "Compare our packages with the top five competitors.", assignee: "priya", priority: "HIGH", status: "IN_PROGRESS", assignedDaysAgo: 2, dueInDays: 2, startedDaysAgo: 1 },
      { title: "Draft the Q4 campaign calendar", description: "Channels, dates and budget per campaign.", assignee: "karan", priority: "MEDIUM", status: "PENDING", assignedDaysAgo: 2, dueInDays: 4 },
    ],
  },
];

/** Assigned by the owner straight to an employee, skipping the manager. */
const ownerDirect: SeedTask[] = [
  { title: "Renew the office lease", description: "Negotiate the renewal with the landlord; aim for a 2-year term.", assignee: "sneha", priority: "HIGH", status: "PENDING", assignedDaysAgo: 1, dueInDays: 10 },
];

async function main() {
  console.log("Clearing existing data…");
  await prisma.taskActivity.deleteMany();
  await prisma.task.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hashPassword(SEED_PASSWORD);

  console.log("Creating users…");
  const ownerUser = await createUser(admin, passwordHash);
  const byUsername = new Map<string, string>();
  for (const m of [...managers, ...members, ...outsiders]) {
    const user = await createUser(m, passwordHash);
    byUsername.set(m.username, user.id);
  }
  const id = (username: string) => byUsername.get(username)!;

  console.log("Creating teams…");
  const teams = {
    tech: await prisma.team.create({
      data: { name: "Tech team", description: "Websites, apps and internal tools", managerId: id("rahul") },
    }),
    business: await prisma.team.create({
      data: { name: "Business team", description: "Sales, clients, marketing and operations", managerId: id("divya") },
    }),
  };
  for (const m of members) {
    const team = teams[TEAM_OF[m.username]!];
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: id(m.username), addedById: team.managerId, joinedAt: at(-30) },
    });
  }

  console.log("Creating tasks…");
  for (const t of tasks) {
    const team = teams[TEAM_OF[t.assignee]!];
    await createSeedTask(t, { teamId: team.id, assigneeId: id(t.assignee), createdById: team.managerId });
  }
  let subtaskCount = 0;
  for (const d of delegated) {
    const team = teams[d.team];
    const parent = await createSeedTask(d.task, { teamId: team.id, assigneeId: id(d.task.assignee), createdById: ownerUser.id });
    for (const sub of d.subtasks) {
      await createSeedTask(sub, { teamId: team.id, assigneeId: id(sub.assignee), createdById: team.managerId, parentId: parent.id });
      subtaskCount++;
    }
  }
  for (const t of ownerDirect) {
    const team = teams[TEAM_OF[t.assignee]!];
    await createSeedTask(t, { teamId: team.id, assigneeId: id(t.assignee), createdById: ownerUser.id });
  }

  console.log(
    `Done: 1 owner, ${managers.length} managers, ${members.length} employees, ${outsiders.length} people without a team, ` +
      `${tasks.length + delegated.length + ownerDirect.length} tasks and ${subtaskCount} subtasks.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
