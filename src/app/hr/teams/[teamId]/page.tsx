import type { Metadata } from "next";
import { TeamDetailView } from "@/components/workspace/views/team-detail-view";
import { requireHR } from "@/server/session";

export const metadata: Metadata = { title: "Team" };

export default async function HRTeamPage({ params }: PageProps<"/hr/teams/[teamId]">) {
  const hr = await requireHR();
  const { teamId } = await params;
  return <TeamDetailView viewer={hr} base="/hr" teamId={teamId} />;
}
