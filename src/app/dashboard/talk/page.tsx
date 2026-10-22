import type { Metadata } from "next";
import { TalkView } from "@/components/conversations/views/talk-view";
import { requireEmployee } from "@/server/session";

export const metadata: Metadata = { title: "Talk to the owner" };

export default async function EmployeeTalkPage() {
  const user = await requireEmployee();
  return <TalkView viewer={user} base="/dashboard" />;
}
