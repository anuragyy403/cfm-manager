import { config } from "dotenv";

config({ quiet: true });

// Tests always run against the separate test database, never the dev data.
const testUrl =
  process.env.DATABASE_URL_TEST ??
  "postgresql://cfm:cfm_dev_password@localhost:5433/cfm_manager_test?schema=public";
const host = new URL(testUrl).hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(host) || !testUrl.includes("test")) {
  throw new Error(`Refusing to run tests against ${host}: DATABASE_URL_TEST must be a local *test* database.`);
}
process.env.DATABASE_URL = testUrl;
