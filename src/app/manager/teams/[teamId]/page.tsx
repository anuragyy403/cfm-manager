import type { Metadata } from "next";
import { TeamDetailView } from "@/components/workspace/views/team-detail-view";
import { requireManager } from "@/server/session";

export const metadata: Metadata = { title: "Team" };

export default async function ManagerTeamPage({ params }: PageProps<"/manager/teams/[teamId]">) {
  const manager = await requireManager();
  const { teamId } = await params;
  return <TeamDetailView viewer={manager} base="/manager" teamId={teamId} />;
}
