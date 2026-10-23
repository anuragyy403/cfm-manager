import { ChatView } from "@/components/chat/chat-view";
import { requireManager } from "@/server/session";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireManager();
  return <ChatView viewer={viewer} base="/manager" searchParams={await searchParams} />;
}
