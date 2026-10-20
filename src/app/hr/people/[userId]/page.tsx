import type { Metadata } from "next";
import { PersonView } from "@/components/workspace/views/person-view";
import { requireHR } from "@/server/session";

export const metadata: Metadata = { title: "Person" };

export default async function HRPersonPage({ params }: PageProps<"/hr/people/[userId]">) {
  const hr = await requireHR();
  const { userId } = await params;
  return <PersonView viewer={hr} base="/hr" userId={userId} />;
}
