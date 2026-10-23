import { WorkReportView } from "@/components/reports/work-report-view";
import { requireManager } from "@/server/session";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireManager();
  return <WorkReportView viewer={viewer} base="/manager" searchParams={await searchParams} />;
}
