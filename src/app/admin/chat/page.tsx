import { ChatView } from "@/components/chat/chat-view";
import { requireOwner } from "@/server/session";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireOwner();
  return <ChatView viewer={viewer} base="/admin" searchParams={await searchParams} />;
}
