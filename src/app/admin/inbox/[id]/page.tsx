import type { Metadata } from "next";
import { ConversationView } from "@/components/conversations/views/conversation-view";
import { requireOwner } from "@/server/session";

export const metadata: Metadata = { title: "Inbox" };

export default async function OwnerConversationPage({ params }: PageProps<"/admin/inbox/[id]">) {
  const owner = await requireOwner();
  const { id } = await params;
  return <ConversationView viewer={owner} base="/admin" id={id} />;
}
