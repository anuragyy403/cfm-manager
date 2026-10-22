import type { Metadata } from "next";
import { TalkView } from "@/components/conversations/views/talk-view";
import { requireHR } from "@/server/session";

export const metadata: Metadata = { title: "Talk to the owner" };

export default async function HRTalkPage() {
  const user = await requireHR();
  return <TalkView viewer={user} base="/hr" />;
}
