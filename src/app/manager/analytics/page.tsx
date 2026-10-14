import type { Metadata } from "next";
import { AnalyticsView } from "@/components/workspace/views/analytics-view";
import { requireManager } from "@/server/session";

export const metadata: Metadata = { title: "Analytics" };

export default async function ManagerAnalyticsPage({ searchParams }: PageProps<"/manager/analytics">) {
  const manager = await requireManager();
  return <AnalyticsView viewer={manager} base="/manager" searchParams={await searchParams} />;
}
