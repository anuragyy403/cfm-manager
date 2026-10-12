import type { Metadata } from "next";
import Link from "next/link";
import { subDays } from "date-fns";
import { AlertTriangle, CheckCircle2, ClipboardList, Clock, Target, Timer } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatDuration, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getTeamAnalytics, getWeeklyTrend } from "@/server/analytics";
import { requireAdmin } from "@/server/session";
import { RateChart, WeeklyTrendChart, WorkloadChart } from "./charts";

export const metadata: Metadata = { title: "Analytics" };

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
] as const;

const pct = (v: number | null) => (v === null ? 0 : Math.round(v * 100));

export default async function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  const admin = await requireAdmin();
  const { range: rangeParam } = await searchParams;
  const range = RANGES.find((r) => r.value === rangeParam)?.value ?? "30";
  const since = range === "all" ? undefined : subDays(new Date(), Number(range));

  const [analytics, trend] = await Promise.all([getTeamAnalytics(admin, since), getWeeklyTrend(admin, 8)]);

  if (!analytics) {
    return (
      <>
        <PageHeader title="Analytics" />
        <p className="text-muted-foreground">
          <Link href="/admin/team" className="text-primary hover:underline">Create your team</Link> to see performance
          analytics.
        </p>
      </>
    );
  }

  const t = analytics.team;
  const members = [...analytics.members].sort(
    (a, b) => (b.metrics.completionRate ?? -1) - (a.metrics.completionRate ?? -1) || b.metrics.total - a.metrics.total,
  );
  const short = (name: string) => {
    const [first, last] = name.split(" ");
    return last ? `${first} ${last[0]}.` : first!;
  };

  return (
    <>
      <PageHeader
        title="Performance analytics"
        description={`How effectively your team completes assigned work. Metrics cover tasks assigned ${
          range === "all" ? "at any time" : `in the ${RANGES.find((r) => r.value === range)!.label.toLowerCase()}`
        }; archived tasks are excluded.`}
      />

      {/* Filters live in one row above the charts. */}
      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-lg bg-muted p-1 sm:w-fit" aria-label="Date range">
        {RANGES.map((r) => (
          <Link
            key={r.value}
            href={`/admin/analytics?range=${r.value}`}
            scroll={false}
            aria-current={range === r.value ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              range === r.value && "bg-background text-foreground shadow-sm",
            )}
          >
            {r.label}
          </Link>
        ))}
      </nav>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Tasks assigned" value={t.total} icon={ClipboardList} hint={`${t.inProgress} in progress · ${t.pending} pending`} />
        <StatCard label="Completed" value={t.completed} icon={CheckCircle2} tone="green" />
        <StatCard label="Completion rate" value={formatPercent(t.completionRate)} icon={Target} hint="Completed ÷ assigned" />
        <StatCard
          label="On-time rate"
          value={formatPercent(t.onTimeRate)}
          icon={Clock}
          tone="amber"
          hint={`${t.completedOnTime} on time · ${t.completedLate} late`}
        />
        <StatCard label="Overdue now" value={t.overdue} icon={AlertTriangle} tone={t.overdue ? "red" : "default"} />
        <StatCard label="Avg. time to complete" value={formatDuration(t.avgCompletionMs)} icon={Timer} hint="Assignment → completion" />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Team productivity</CardTitle>
            <CardDescription>Tasks assigned vs. completed per week, last 8 weeks.</CardDescription>
          </CardHeader>
          <CardContent>
            <WeeklyTrendChart
              data={trend.map((p) => ({ week: formatDate(p.weekStart), assigned: p.assigned, completed: p.completed }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Workload by member</CardTitle>
            <CardDescription>Each member&apos;s tasks split by current status.</CardDescription>
          </CardHeader>
          <CardContent>
            <WorkloadChart
              data={members.map((m) => ({
                name: short(m.user.name),
                completed: m.metrics.completed,
                inProgress: m.metrics.inProgress,
                pending: m.metrics.pending,
                overdue: m.metrics.overdue,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Completion rate by member</CardTitle>
            <CardDescription>Share of each member&apos;s assigned tasks that are completed.</CardDescription>
          </CardHeader>
          <CardContent>
            <RateChart
              label="Completion rate"
              data={members.filter((m) => m.metrics.total > 0).map((m) => ({ name: short(m.user.name), rate: pct(m.metrics.completionRate) }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>On-time rate by member</CardTitle>
            <CardDescription>Share of completed tasks finished by the deadline.</CardDescription>
          </CardHeader>
          <CardContent>
            <RateChart
              label="On-time rate"
              data={[...members]
                .filter((m) => m.metrics.completed > 0)
                .sort((a, b) => (b.metrics.onTimeRate ?? 0) - (a.metrics.onTimeRate ?? 0))
                .map((m) => ({ name: short(m.user.name), rate: pct(m.metrics.onTimeRate) }))}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Member performance summary</CardTitle>
          <CardDescription>Exact figures behind the charts. Members needing attention are highlighted.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Member</TableHead>
                <TableHead className="text-right">Assigned</TableHead>
                <TableHead className="text-right">Completed</TableHead>
                <TableHead className="text-right">In progress</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
                <TableHead className="text-right">Completion</TableHead>
                <TableHead className="text-right">On time</TableHead>
                <TableHead className="pr-6 text-right">Avg. time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map(({ user, metrics: m }) => {
                const needsAttention = m.overdue > 0 || (m.onTimeRate !== null && m.onTimeRate < 0.5);
                return (
                  <TableRow key={user.id}>
                    <TableCell className="pl-6">
                      <Link href={`/admin/team/${user.id}`} className="font-medium hover:underline">
                        {user.name}
                      </Link>
                      {needsAttention && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                          <AlertTriangle className="size-3" /> Needs attention
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{m.total}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.completed}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.inProgress}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.pending}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", m.overdue && "font-medium text-red-600 dark:text-red-400")}>
                      {m.overdue}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatPercent(m.completionRate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPercent(m.onTimeRate)}</TableCell>
                    <TableCell className="pr-6 text-right tabular-nums">{formatDuration(m.avgCompletionMs)}</TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-muted/40 font-medium">
                <TableCell className="pl-6">Whole team</TableCell>
                <TableCell className="text-right tabular-nums">{t.total}</TableCell>
                <TableCell className="text-right tabular-nums">{t.completed}</TableCell>
                <TableCell className="text-right tabular-nums">{t.inProgress}</TableCell>
                <TableCell className="text-right tabular-nums">{t.pending}</TableCell>
                <TableCell className="text-right tabular-nums">{t.overdue}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPercent(t.completionRate)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPercent(t.onTimeRate)}</TableCell>
                <TableCell className="pr-6 text-right tabular-nums">{formatDuration(t.avgCompletionMs)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
