/**
 * Grants the ADMIN role to an existing account.
 *
 *   npm run make-admin -- someone@company.com
 *
 * This is the only way an account becomes an admin: the role can never be
 * chosen at sign-up. Run it from a machine that has the production
 * DATABASE_URL once the real admin has registered.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run make-admin -- <email>");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No account found for ${email}. Sign up first, then rerun.`);
    process.exitCode = 1;
    return;
  }
  if (user.role === "ADMIN") {
    console.log(`${email} is already an admin.`);
    return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  // Drop existing sessions so the new role takes effect on next sign-in.
  await prisma.session.deleteMany({ where: { userId: user.id } });
  console.log(`${email} is now an admin. They need to sign in again.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
