// Applies migrations to the local test database used by `npm test`.
import { execSync } from "node:child_process";
import "dotenv/config";

const url =
  process.env.DATABASE_URL_TEST ??
  "postgresql://cfm:cfm_dev_password@localhost:5433/cfm_manager_test?schema=public";

execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});
