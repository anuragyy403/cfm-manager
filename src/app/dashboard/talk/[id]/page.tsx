import type { Metadata } from "next";
import { ConversationView } from "@/components/conversations/views/conversation-view";
import { requireEmployee } from "@/server/session";

export const metadata: Metadata = { title: "Concern" };

export default async function EmployeeCasePage({ params }: PageProps<"/dashboard/talk/[id]">) {
  const user = await requireEmployee();
  const { id } = await params;
  return <ConversationView viewer={user} base="/dashboard" id={id} />;
}
