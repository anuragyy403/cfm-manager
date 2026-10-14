import type { Metadata } from "next";
import { TeamsView } from "@/components/workspace/views/teams-view";
import { requireOwner } from "@/server/session";

export const metadata: Metadata = { title: "Teams" };

export default async function OwnerTeamsPage() {
  const owner = await requireOwner();
  return <TeamsView viewer={owner} base="/admin" />;
}
