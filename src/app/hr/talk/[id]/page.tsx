import type { Metadata } from "next";
import { ConversationView } from "@/components/conversations/views/conversation-view";
import { requireHR } from "@/server/session";

export const metadata: Metadata = { title: "Concern" };

export default async function HRCasePage({ params }: PageProps<"/hr/talk/[id]">) {
  const user = await requireHR();
  const { id } = await params;
  return <ConversationView viewer={user} base="/hr" id={id} />;
}
