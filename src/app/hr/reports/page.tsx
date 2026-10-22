import type { Metadata } from "next";
import { ConversationView } from "@/components/conversations/views/conversation-view";
import { hrDesk } from "@/server/conversations";
import { requireHR } from "@/server/session";

export const metadata: Metadata = { title: "Meeting reports" };

/** HR's private desk with the owner: meeting reports and messages. */
export default async function HRReportsPage() {
  const hr = await requireHR();
  const desk = await hrDesk(hr);
  return <ConversationView viewer={hr} base="/hr" id={desk.id} />;
}
