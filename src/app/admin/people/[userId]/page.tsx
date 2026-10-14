import type { Metadata } from "next";
import { PersonView } from "@/components/workspace/views/person-view";
import { requireOwner } from "@/server/session";

export const metadata: Metadata = { title: "Person" };

export default async function OwnerPersonPage({ params }: PageProps<"/admin/people/[userId]">) {
  const owner = await requireOwner();
  const { userId } = await params;
  return <PersonView viewer={owner} base="/admin" userId={userId} />;
}
