import type { Metadata } from "next";
import { InboxView } from "@/components/conversations/views/inbox-view";
import { requireOwner } from "@/server/session";

export const metadata: Metadata = { title: "Inbox" };

const TABS = ["active", "resolved", "withdrawn", "hr"] as const;

export default async function OwnerInboxPage({ searchParams }: PageProps<"/admin/inbox">) {
  const owner = await requireOwner();
  const { tab } = await searchParams;
  const current = TABS.find((t) => t === tab) ?? "active";
  return <InboxView owner={owner} tab={current} />;
}
