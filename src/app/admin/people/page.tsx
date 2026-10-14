import type { Metadata } from "next";
import { PeopleView } from "@/components/workspace/views/people-view";
import { requireOwner } from "@/server/session";

export const metadata: Metadata = { title: "People" };

export default async function OwnerPeoplePage() {
  const owner = await requireOwner();
  return <PeopleView owner={owner} base="/admin" />;
}
