import Link from "next/link";
import { subDays } from "date-fns";
import { AlertTriangle, CheckCircle2, ClipboardList, Clock, Target, Timer } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
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
import type { TaskMetrics } from "@/lib/tasks/metrics";
import { cn } from "@/lib/utils";
import { isOwner } from "@/server/access";
import { getTeamAnalytics, getWeeklyTrend } from "@/server/analytics";
import type { CurrentUser } from "@/server/session";
import { listTeams } from "@/server/teams";
import { RateChart, WeeklyTrendChart, WorkloadChart } from "../charts";

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
] as const;

const pct = (v: number | null) => (v === null ? 0 : Math.round(v * 100));

type SearchParams = Record<string, string | string[] | undefined>;

/** Performance analytics for the lead's teams, filterable by date range and team. */
export async function AnalyticsView({
  viewer,
  base,
  searchParams,
}: {
  viewer: CurrentUser;
  base: string;
  searchParams: SearchParams;
}) {
  const rangeParam = typeof searchParams.range === "string" ? searchParams.range : undefined;
  const range = RANGES.find((r) => r.value === rangeParam)?.value ?? "30";
  const since = range === "all" ? undefined : subDays(new Date(), Number(range));

  const teams = await listTeams(viewer);
  const teamParam = typeof searchParams.team === "string" ? searchParams.team : undefined;
  const teamId = teams.some((t) => t.id === teamParam) ? teamParam : undefined;

  const [analytics, trend] = await Promise.all([
    getTeamAnalytics(viewer, { since, teamId }),
    getWeeklyTrend(viewer, { weeks: 8, teamId }),
  ]);

  const href = (changes: { range?: string; team?: string | null }) => {
    const p = new URLSearchParams();
    const r = changes.range ?? range;
    const t = changes.team === undefined ? teamId : changes.team;
    if (r !== "30") p.set("range", r);
    if (t) p.set("team", t);
    const qs = p.toString();
    return `${base}/analytics${qs ? `?${qs}` : ""}`;
  };

  if (!analytics) {
    return (
      <>
        <PageHeader title="Analytics" />
        <p className="text-muted-foreground">
          <Link href={`${base}/teams`} className="text-primary hover:underline">
            Create a team
          </Link>{" "}
          to see performance analytics.
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
  const multiTeam = teams.length > 1;
  const compareTeams = multiTeam && !teamId;
  const scopeLabel = teamId
    ? teams.find((x) => x.id === teamId)!.name
    : isOwner(viewer)
      ? "the whole company"
      : multiTeam
        ? "your teams"
        : "your team";

  return (
    <>
      <PageHeader
        title="Performance analytics"
        description={`How effectively ${scopeLabel} completes assigned work. Metrics cover tasks assigned ${
          range === "all" ? "at any time" : `in the ${RANGES.find((r) => r.value === range)!.label.toLowerCase()}`
        }; archived tasks are excluded.`}
      />

      {/* Filters live in one row above the charts. */}
      <div className="mb-6 flex flex-col gap-2 lg:flex-row">
        <FilterNav label="Date range">
          {RANGES.map((r) => (
            <FilterLink key={r.value} href={href({ range: r.value })} active={range === r.value}>
              {r.label}
            </FilterLink>
          ))}
        </FilterNav>
        {multiTeam && (
          <FilterNav label="Team">
            <FilterLink href={href({ team: null })} active={!teamId}>
              All teams
            </FilterLink>
            {teams.map((x) => (
              <FilterLink key={x.id} href={href({ team: x.id })} active={teamId === x.id}>
                {x.name}
              </FilterLink>
            ))}
          </FilterNav>
        )}
      </div>

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

      {compareTeams && (
        <div className="mb-6 grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Workload by team</CardTitle>
              <CardDescription>Each team&apos;s tasks split by current status.</CardDescription>
            </CardHeader>
            <CardContent>
              <WorkloadChart
                data={analytics.teams.map((x) => ({
                  name: x.name,
                  completed: x.metrics.completed,
                  inProgress: x.metrics.inProgress,
                  pending: x.metrics.pending,
                  overdue: x.metrics.overdue,
                }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Completion rate by team</CardTitle>
              <CardDescription>Share of each team&apos;s assigned tasks that are completed.</CardDescription>
            </CardHeader>
            <CardContent>
              <RateChart
                label="Completion rate"
                data={analytics.teams
                  .filter((x) => x.metrics.total > 0)
                  .map((x) => ({ name: x.name, rate: pct(x.metrics.completionRate) }))}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Productivity</CardTitle>
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
            <CardTitle>Workload by person</CardTitle>
            <CardDescription>Each person&apos;s tasks split by current status.</CardDescription>
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
            <CardTitle>Completion rate by person</CardTitle>
            <CardDescription>Share of each person&apos;s assigned tasks that are completed.</CardDescription>
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
            <CardTitle>On-time rate by person</CardTitle>
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

      {compareTeams && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Team summary</CardTitle>
            <CardDescription>Exact figures for each team.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <MetricsHead first="Team" extra="Manager" />
              <TableBody>
                {analytics.teams.map((x) => (
                  <TableRow key={x.id}>
                    <TableCell className="pl-6">
                      <Link href={`${base}/teams/${x.id}`} className="font-medium hover:underline">
                        {x.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{x.manager.name}</TableCell>
                    <MetricsCells m={x.metrics} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>People summary</CardTitle>
          <CardDescription>Exact figures behind the charts. People needing attention are highlighted.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <MetricsHead first="Person" extra={multiTeam ? "Team" : undefined} />
            <TableBody>
              {members.map(({ user, metrics: m, isManager, team }) => {
                const needsAttention = m.overdue > 0 || (m.onTimeRate !== null && m.onTimeRate < 0.5);
                const canOpen = isOwner(viewer) || !isManager;
                return (
                  <TableRow key={`${team.id}:${user.id}`}>
                    <TableCell className="pl-6">
                      {canOpen ? (
                        <Link href={`${base}/people/${user.id}`} className="font-medium hover:underline">
                          {user.name}
                        </Link>
                      ) : (
                        <span className="font-medium">{user.id === viewer.id ? `${user.name} (you)` : user.name}</span>
                      )}
                      {isManager && (
                        <Badge variant="secondary" className="ml-2">
                          Manager
                        </Badge>
                      )}
                      {needsAttention && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                          <AlertTriangle className="size-3" /> Needs attention
                        </span>
                      )}
                    </TableCell>
                    {multiTeam && <TableCell className="text-muted-foreground">{team.name}</TableCell>}
                    <MetricsCells m={m} />
                  </TableRow>
                );
              })}
              <TableRow className="bg-muted/40 font-medium">
                <TableCell className="pl-6">Total</TableCell>
                {multiTeam && <TableCell />}
                <MetricsCells m={t} />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function FilterNav({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1 sm:w-fit" aria-label={label}>
      {children}
    </nav>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={cn(
        "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
        active && "bg-background text-foreground shadow-sm",
      )}
    >
      {children}
    </Link>
  );
}

function MetricsHead({ first, extra }: { first: string; extra?: string }) {
  return (
    <TableHeader>
      <TableRow>
        <TableHead className="pl-6">{first}</TableHead>
        {extra && <TableHead>{extra}</TableHead>}
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
  );
}

function MetricsCells({ m }: { m: TaskMetrics }) {
  return (
    <>
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
    </>
  );
}
