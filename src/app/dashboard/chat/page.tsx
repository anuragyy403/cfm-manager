import { ChatView } from "@/components/chat/chat-view";
import { requireEmployee } from "@/server/session";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireEmployee();
  return <ChatView viewer={viewer} base="/dashboard" searchParams={await searchParams} />;
}
