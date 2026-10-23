import { DomainError } from "@/server/access";
import { getWorkReport, reportCsv } from "@/server/reports";
import { getCurrentUser } from "@/server/session";

export async function GET(request: Request) {
  const viewer = await getCurrentUser();
  if (!viewer) return new Response("Sign in to generate a report.", { status: 401 });
  try {
    const report = await getWorkReport(viewer, Object.fromEntries(new URL(request.url).searchParams));
    return new Response(reportCsv(report), { headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="cfm-work-report.csv"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    if (error instanceof DomainError) return new Response(error.message, { status: 400 });
    throw error;
  }
}
