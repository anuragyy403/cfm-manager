/**
 * Hands the owner role to another account and deletes the previous owner's
 * account. Everything the old account held moves to the new owner: the teams
 * it managed, tasks assigned to it or created by it, and its activity
 * history.
 *
 *   npm run replace-owner -- <new-owner-email> <old-owner-email>           (dry run)
 *   npm run replace-owner -- <new-owner-email> <old-owner-email> --apply
 *
 * The new owner must already have an account (signed up). Without --apply it
 * only prints what would change. Run with the production DATABASE_URL to
 * change the live site.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const [newEmail, oldEmail] = process.argv.slice(2).filter((a) => !a.startsWith("--")).map((a) => a.trim().toLowerCase());
const apply = process.argv.includes("--apply");
if (!newEmail || !oldEmail || newEmail === oldEmail) {
  console.error("Usage: npm run replace-owner -- <new-owner-email> <old-owner-email> [--apply]");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const [next, prev] = await Promise.all([
    prisma.user.findUnique({ where: { email: newEmail } }),
    prisma.user.findUnique({
      where: { email: oldEmail },
      include: {
        managedTeams: { select: { name: true } },
        _count: { select: { assignedTasks: true, createdTasks: true, taskActivities: true } },
      },
    }),
  ]);
  if (!next) {
    console.error(`No account found for ${newEmail}. Sign up with that email first, then rerun.`);
    process.exitCode = 1;
    return;
  }
  if (!prev) {
    console.error(`No account found for ${oldEmail}.`);
    process.exitCode = 1;
    return;
  }
  const otherOwners = await prisma.user.findMany({
    where: { role: "ADMIN", id: { notIn: [next.id, prev.id] } },
    select: { email: true },
  });
  if (otherOwners.length) {
    console.error(`Another account is the owner (${otherOwners.map((u) => u.email).join(", ")}). Nothing changed.`);
    process.exitCode = 1;
    return;
  }

  console.log(`New owner:      ${next.name} <${next.email}> (currently ${next.role})`);
  console.log(`Account to delete: ${prev.name} <${prev.email}> (currently ${prev.role})`);
  console.log(`  teams it manages -> new owner: ${prev.managedTeams.map((t) => t.name).join(", ") || "none"}`);
  console.log(`  tasks assigned to it -> new owner: ${prev._count.assignedTasks}`);
  console.log(`  tasks it created -> new owner: ${prev._count.createdTasks}`);
  console.log(`  activity entries -> new owner: ${prev._count.taskActivities}`);

  if (!apply) {
    console.log("\nDry run only. Add --apply to make these changes.");
    return;
  }

  await prisma.$transaction([
    // The owner is never an employee on a team.
    prisma.teamMember.deleteMany({ where: { userId: next.id } }),
    prisma.user.update({ where: { id: prev.id }, data: { role: "MEMBER" } }),
    prisma.user.update({ where: { id: next.id }, data: { role: "ADMIN" } }),
    prisma.team.updateMany({ where: { managerId: prev.id }, data: { managerId: next.id } }),
    prisma.task.updateMany({ where: { assigneeId: prev.id }, data: { assigneeId: next.id } }),
    prisma.task.updateMany({ where: { createdById: prev.id }, data: { createdById: next.id } }),
    prisma.taskActivity.updateMany({ where: { actorId: prev.id }, data: { actorId: next.id } }),
    // Sessions, sign-in records and memberships go with the account (cascade).
    prisma.user.delete({ where: { id: prev.id } }),
    // The new role takes effect on next sign-in.
    prisma.session.deleteMany({ where: { userId: next.id } }),
  ]);
  console.log(`\nDone. ${newEmail} is the owner and ${oldEmail} has been deleted. ${newEmail} needs to sign in again.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
