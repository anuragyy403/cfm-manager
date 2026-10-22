import type { Metadata } from "next";
import { TalkView } from "@/components/conversations/views/talk-view";
import { requireManager } from "@/server/session";

export const metadata: Metadata = { title: "Talk to the owner" };

export default async function ManagerTalkPage() {
  const user = await requireManager();
  return <TalkView viewer={user} base="/manager" />;
}
