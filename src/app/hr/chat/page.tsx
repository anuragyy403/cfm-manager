import { ChatView } from "@/components/chat/chat-view";
import { requireHR } from "@/server/session";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireHR();
  return <ChatView viewer={viewer} base="/hr" searchParams={await searchParams} />;
}
