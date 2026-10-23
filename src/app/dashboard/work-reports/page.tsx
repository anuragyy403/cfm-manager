import { WorkReportView } from "@/components/reports/work-report-view";
import { requireEmployee } from "@/server/session";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireEmployee();
  return <WorkReportView viewer={viewer} base="/dashboard" searchParams={await searchParams} />;
}
