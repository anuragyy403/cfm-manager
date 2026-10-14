import type { Metadata } from "next";
import { PersonView } from "@/components/workspace/views/person-view";
import { requireManager } from "@/server/session";

export const metadata: Metadata = { title: "Employee" };

export default async function ManagerPersonPage({ params }: PageProps<"/manager/people/[userId]">) {
  const manager = await requireManager();
  const { userId } = await params;
  return <PersonView viewer={manager} base="/manager" userId={userId} />;
}
