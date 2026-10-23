import { WorkReportView } from "@/components/reports/work-report-view";
import { requireOwner } from "@/server/session";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireOwner();
  return <WorkReportView viewer={viewer} base="/admin" searchParams={await searchParams} />;
}
