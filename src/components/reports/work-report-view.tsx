import Link from "next/link";
import { CheckCircle2, Clock3, Download, AlertTriangle, CircleDashed } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { PrintReport } from "@/components/reports/print-report";
import { ReportFilters } from "@/components/reports/report-filters";
import { APP_TIMEZONE, formatDateTime } from "@/lib/format";
import { DomainError } from "@/server/access";
import { getWorkReport, reportStatus, type ReportParams, type WorkReport } from "@/server/reports";
import type { CurrentUser } from "@/server/session";

export async function WorkReportView({ viewer, base, searchParams }: { viewer: CurrentUser; base: string; searchParams: ReportParams }) {
  let report: WorkReport;
  try {
    report = await getWorkReport(viewer, searchParams);
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    return <div><PageHeader title="Work reports" /><div role="alert" className="rounded-xl border p-6"><p>{error.message}</p><Button asChild variant="outline" className="mt-4"><Link href={`${base}/work-reports`}>Clear filters</Link></Button></div></div>;
  }
  const { filters, rows } = report;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ team: filters.teamId, person: filters.personId, from: filters.from, to: filters.to })) if (value) query.set(key, value);
  const done = rows.filter((t) => t.status === "COMPLETED");
  const review = rows.filter((t) => t.status === "SUBMITTED");
  const unfinished = rows.filter((t) => t.status !== "COMPLETED" && t.status !== "SUBMITTED");
  const overdue = unfinished.filter((t) => t.overdue).length;
  return (
    <div className="work-report space-y-6">
      <PageHeader title="Work reports" description="Generate a record of assigned work, what passed review, and what still needs attention." actions={<div className="flex flex-wrap gap-2 print:hidden"><Button asChild variant="brand"><a href={`/api/reports?${query}`}><Download />Export CSV</a></Button><PrintReport /></div>} />
      <ReportFilters key={query.toString()} base={base} teams={report.teams} people={report.people.map((p) => ({ ...p, deletedAt: p.deletedAt?.toISOString() ?? null }))} filters={filters} personal={viewer.role === "MEMBER"} />
      <p className="text-sm text-muted-foreground">{report.teams.find((t) => t.id === filters.teamId)?.name ?? "All permitted teams"} · {report.people.find((p) => p.id === filters.personId)?.name ?? (viewer.role === "MEMBER" ? viewer.name : "All permitted employees")} · Assignment dates: {filters.from || "no start date"} to {filters.to || "no end date"}. Dates use {APP_TIMEZONE}; the end date is included. Archived tasks are excluded; subtasks count separately.</p>
      <div className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-5 sm:grid-cols-4">
        {[
          { label: "Done · passed review", value: done.length, Icon: CheckCircle2, color: "text-emerald-700 dark:text-emerald-400" },
          { label: "Waiting for review", value: review.length, Icon: Clock3, color: "text-sun-deep" },
          { label: "Not done", value: unfinished.length, Icon: CircleDashed, color: "text-foreground" },
          { label: "Overdue · included in not done", value: overdue, Icon: AlertTriangle, color: "text-destructive" },
        ].map(({ label, value, Icon, color }) => <div key={label}><div className={`mb-2 flex items-center gap-2 text-sm ${color}`}><Icon className="size-4 shrink-0" /><span>{label}</span></div><p className="text-3xl font-semibold tabular-nums">{value}</p></div>)}
      </div>
      <p className="text-sm text-muted-foreground">{rows.length} assigned tasks · {rows.length ? Math.round(done.length / rows.length * 100) : 0}% completed. Work counts as done only after it passes review.</p>
      {rows.length === 0 ? <div className="rounded-xl border border-dashed p-10 text-center"><h2 className="font-semibold">No tasks match these filters</h2><p className="mt-2 text-sm text-muted-foreground">Try a wider date range or choose another team or employee.</p></div> : <>
        <TaskSection title="Not done" description="Pending and in-progress work. Overdue tasks are highlighted." tasks={unfinished} base={base} />
        <TaskSection title="Waiting for review" description="Submitted work awaiting a pass or revision. These tasks are not overdue." tasks={review} base={base} />
        <TaskSection title="Done · passed review" description="Completed work approved by a reviewer." tasks={done} base={base} />
      </>}
      <p className="text-xs text-muted-foreground">Generated {formatDateTime(report.generatedAt)} · CFM Workplace</p>
    </div>
  );
}

function TaskSection({ title, description, tasks, base }: { title: string; description: string; tasks: WorkReport["rows"]; base: string }) {
  return <section className="space-y-3"><div><h2 className="text-lg font-semibold">{title} <span className="text-muted-foreground">({tasks.length})</span></h2><p className="text-sm text-muted-foreground">{description}</p></div>{!tasks.length ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No tasks in this section.</p> : <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-left text-sm"><thead className="border-b bg-muted/50 text-muted-foreground"><tr>{["Task", "Employee / team", "Result", "Deadline"].map((h) => <th scope="col" key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y">{tasks.map((task) => <tr key={task.id} className={task.overdue ? "bg-destructive/5" : ""}><td className="min-w-52 px-4 py-4 align-top"><Link href={`${base}/tasks/${task.id}`} className="font-medium underline-offset-4 hover:underline">{task.title}</Link>{task.parentId && <span className="ml-2 text-xs text-muted-foreground">Subtask</span>}{task.completionNote && <p className="mt-1 max-w-prose whitespace-pre-wrap break-words text-xs text-muted-foreground">{task.completionNote}</p>}</td><td className="px-4 py-4 align-top"><p>{task.assignee.name}</p><p className="text-xs text-muted-foreground">{task.team.name}</p></td><td className="px-4 py-4 align-top"><span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${task.status === "COMPLETED" ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : task.overdue ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"}`}>{reportStatus(task)}</span></td><td className="whitespace-nowrap px-4 py-4 align-top tabular-nums">{formatDateTime(task.dueAt)}{task.completedAt && <p className="mt-1 text-xs text-muted-foreground">Passed {formatDateTime(task.completedAt)}</p>}</td></tr>)}</tbody></table></div>}</section>;
}
