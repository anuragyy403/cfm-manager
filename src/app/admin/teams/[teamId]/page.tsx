import type { Metadata } from "next";
import { TeamDetailView } from "@/components/workspace/views/team-detail-view";
import { requireOwner } from "@/server/session";

export const metadata: Metadata = { title: "Team" };

export default async function OwnerTeamPage({ params }: PageProps<"/admin/teams/[teamId]">) {
  const owner = await requireOwner();
  const { teamId } = await params;
  return <TeamDetailView viewer={owner} base="/admin" teamId={teamId} />;
}
