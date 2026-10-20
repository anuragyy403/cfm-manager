import type { Metadata } from "next";
import { TeamsView } from "@/components/workspace/views/teams-view";
import { requireHR } from "@/server/session";

export const metadata: Metadata = { title: "Teams" };

export default async function HRTeamsPage() {
  const hr = await requireHR();
  return <TeamsView viewer={hr} base="/hr" />;
}
