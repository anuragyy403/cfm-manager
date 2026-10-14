import type { Metadata } from "next";
import { AnalyticsView } from "@/components/workspace/views/analytics-view";
import { requireOwner } from "@/server/session";

export const metadata: Metadata = { title: "Analytics" };

export default async function OwnerAnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  const owner = await requireOwner();
  return <AnalyticsView viewer={owner} base="/admin" searchParams={await searchParams} />;
}
