import type { Metadata } from "next";
import { AnalyticsView } from "@/components/workspace/views/analytics-view";
import { requireHR } from "@/server/session";

export const metadata: Metadata = { title: "Analytics" };

export default async function HRAnalyticsPage({ searchParams }: PageProps<"/hr/analytics">) {
  const hr = await requireHR();
  return <AnalyticsView viewer={hr} base="/hr" searchParams={await searchParams} />;
}
