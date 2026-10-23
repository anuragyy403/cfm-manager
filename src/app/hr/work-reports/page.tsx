import { WorkReportView } from "@/components/reports/work-report-view";
import { requireHR } from "@/server/session";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireHR();
  return <WorkReportView viewer={viewer} base="/hr" searchParams={await searchParams} />;
}
