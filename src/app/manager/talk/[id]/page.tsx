import type { Metadata } from "next";
import { ConversationView } from "@/components/conversations/views/conversation-view";
import { requireManager } from "@/server/session";

export const metadata: Metadata = { title: "Concern" };

export default async function ManagerCasePage({ params }: PageProps<"/manager/talk/[id]">) {
  const user = await requireManager();
  const { id } = await params;
  return <ConversationView viewer={user} base="/manager" id={id} />;
}
