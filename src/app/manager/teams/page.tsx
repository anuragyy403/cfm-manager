import type { Metadata } from "next";
import { TeamsView } from "@/components/workspace/views/teams-view";
import { requireManager } from "@/server/session";

export const metadata: Metadata = { title: "Teams" };

export default async function ManagerTeamsPage() {
  const manager = await requireManager();
  return <TeamsView viewer={manager} base="/manager" />;
}
