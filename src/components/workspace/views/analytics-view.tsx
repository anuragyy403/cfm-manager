import Link from "next/link";
import { subDays } from "date-fns";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { Gauge } from "@/components/analytics/gauge";
import { type HighlightTab, Highlights } from "@/components/analytics/highlights";
import { type PersonRow, PeopleTable } from "@/components/analytics/people-table";
import { StatusColumns } from "@/components/analytics/status-columns";
import { RoundIcon, SunCard, SunCardHeader } from "@/components/analytics/sun-card";
import { TrendChart, TrendLegend } from "@/components/analytics/trend-chart";
import { greeting, today } from "@/components/welcome-banner";
import { formatDate, formatDuration } from "@/lib/format";
import type { TaskMetrics } from "@/lib/tasks/metrics";
import { cn } from "@/lib/utils";
import { seesAllTeams } from "@/server/access";
import { getTeamAnalytics, getWeeklyTrend, type PersonPerformance } from "@/server/analytics";
import type { CurrentUser } from "@/server/session";
import { listTeams } from "@/server/teams";

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
] as const;

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const open = (m: TaskMetrics) => m.pending + m.inProgress + m.overdue;

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Performance dashboard for the lead's teams, in the warm "sunlit" style:
 * a hero with the headline numbers and a completion gauge, highlights, the
 * weekly trend, where the work stands, quick links and a people table.
 * Everything below the filter row reflects the same date range and team.
 */
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
  const range = RANGES.find((r) => r.value === rangeParam) ?? RANGES[1];
  const since = range.value === "all" ? undefined : subDays(new Date(), Number(range.value));

  const teams = await listTeams(viewer);
  const teamParam = typeof searchParams.team === "string" ? searchParams.team : undefined;
  const teamId = teams.some((t) => t.id === teamParam) ? teamParam : undefined;

  const [analytics, trend] = await Promise.all([
    getTeamAnalytics(viewer, { since, teamId }),
    getWeeklyTrend(viewer, { weeks: 8, teamId }),
  ]);

  const href = (changes: { range?: string; team?: string | null }) => {
    const p = new URLSearchParams();
    const r = changes.range ?? range.value;
    const t = changes.team === undefined ? teamId : changes.team;
    if (r !== "30") p.set("range", r);
    if (t) p.set("team", t);
    const qs = p.toString();
    return `${base}/analytics${qs ? `?${qs}` : ""}`;
  };
  const tasksHref = (view?: string) => {
    const p = new URLSearchParams();
    if (view) p.set("view", view);
    if (teamId) p.set("team", teamId);
    const qs = p.toString();
    return `${base}/tasks${qs ? `?${qs}` : ""}`;
  };

  const owner = seesAllTeams(viewer);
  const multiTeam = teams.length > 1;
  const scope = teamId
    ? teams.find((x) => x.id === teamId)!.name
    : owner
      ? "the whole company"
      : multiTeam
        ? "your teams"
        : (teams[0]?.name ?? "your team");

  if (!analytics) {
    return (
      <div>
        <SunCard className="flex flex-col items-center gap-3 py-16 text-center">
          <h1 className="text-2xl font-light tracking-tight">No analytics yet</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            Create a team and assign some work. Performance numbers and charts appear here as tasks move along.
          </p>
          <Link
            href={`${base}/teams`}
            className="mt-2 rounded-full bg-[#22211d] px-4 py-2 text-sm font-medium text-white dark:bg-[#f4f1e8] dark:text-[#1f1e1b]"
          >
            Go to teams
          </Link>
        </SunCard>
      </div>
    );
  }

  const t = analytics.team;
  // Managers open employee profiles only; the owner and HR can open anyone's.
  const personHref = (p: PersonPerformance) =>
    owner || p.role === "MEMBER" ? `${base}/people/${p.user.id}` : undefined;
  const roleOf = (p: PersonPerformance) =>
    p.deleted ? "Deleted account" : p.role === "HR" ? "HR" : p.role === "MANAGER" ? "Manager" : "Employee";
  // Where they are now; their record still counts work from earlier teams.
  const whereNow = (p: PersonPerformance) =>
    p.currentTeams.length ? p.currentTeams.join(", ") : "No longer on these teams";

  // ─── Highlights ────────────────────────────────────────────────────────────
  const performers = analytics.people
    .filter((m) => m.metrics.completed > 0)
    .sort(
      (a, b) =>
        (b.metrics.completionRate ?? 0) - (a.metrics.completionRate ?? 0) ||
        (b.metrics.onTimeRate ?? 0) - (a.metrics.onTimeRate ?? 0) ||
        b.metrics.completed - a.metrics.completed,
    )
    .slice(0, 4);
  const attention = analytics.people
    .filter((m) => m.metrics.overdue > 0 || (m.metrics.onTimeRate !== null && m.metrics.onTimeRate < 0.5))
    .sort((a, b) => b.metrics.overdue - a.metrics.overdue || (a.metrics.onTimeRate ?? 1) - (b.metrics.onTimeRate ?? 1))
    .slice(0, 4);

  const tabs: HighlightTab[] = [
    {
      key: "top",
      label: "Top performers",
      empty: "Nobody has completed a task in this period yet.",
      items: performers.map((m) => ({
        id: m.user.id,
        title: m.user.name,
        subtitle: multiTeam ? `${whereNow(m)} · ${roleOf(m)}` : roleOf(m),
        chips: [`${m.metrics.completed}/${m.metrics.total} done`, `${pct(m.metrics.onTimeRate)} on time`],
        href: personHref(m),
        person: { id: m.user.id, name: m.user.name },
      })),
    },
    {
      key: "attention",
      label: "Needs attention",
      empty: "Nobody is behind. Every deadline is on track.",
      items: attention.map((m) => ({
        id: m.user.id,
        title: m.user.name,
        subtitle: multiTeam ? `${whereNow(m)} · ${roleOf(m)}` : roleOf(m),
        chips: [
          ...(m.metrics.overdue ? [`${m.metrics.overdue} overdue`] : []),
          `${pct(m.metrics.onTimeRate)} on time`,
        ],
        href: personHref(m),
        person: { id: m.user.id, name: m.user.name },
      })),
    },
  ];
  if (multiTeam && !teamId) {
    tabs.push({
      key: "teams",
      label: "Teams",
      empty: "No teams yet.",
      items: [...analytics.teams]
        .sort((a, b) => (b.metrics.completionRate ?? -1) - (a.metrics.completionRate ?? -1))
        .map((x) => ({
          id: x.id,
          title: x.name,
          subtitle: `Managed by ${x.manager.id === viewer.id ? "you" : x.manager.name} · ${x.memberCount} employee${
            x.memberCount === 1 ? "" : "s"
          }`,
          chips: [
            `${pct(x.metrics.completionRate)} done`,
            `${open(x.metrics)} open`,
            ...(x.metrics.overdue ? [`${x.metrics.overdue} overdue`] : []),
          ],
          href: `${base}/teams/${x.id}`,
          person: { id: x.manager.id, name: x.manager.name },
        })),
    });
  }

  // ─── Trend ─────────────────────────────────────────────────────────────────
  const trendData = trend.map((p) => ({ week: formatDate(p.weekStart), assigned: p.assigned, completed: p.completed }));
  const completed8 = trend.reduce((n, p) => n + p.completed, 0);
  const recent = trend.slice(-4).reduce((n, p) => n + p.completed, 0);
  const earlier = trend.slice(0, -4).reduce((n, p) => n + p.completed, 0);
  const delta = recent - earlier;

  // ─── People ────────────────────────────────────────────────────────────────
  const rows: PersonRow[] = analytics.people.map((p) => ({
    id: p.user.id,
    name: p.user.name,
    username: p.user.username,
    isYou: p.user.id === viewer.id,
    deleted: p.deleted,
    search: p.currentTeams.join(" "),
    href: personHref(p),
    total: p.metrics.total,
    completed: p.metrics.completed,
    inReview: p.metrics.inReview,
    overdue: p.metrics.overdue,
    completionRate: p.metrics.completionRate,
    onTimeRate: p.metrics.onTimeRate,
    avgTime: formatDuration(p.metrics.avgCompletionMs),
  }));

  const firstName = viewer.name.split(" ")[0];

  return (
    <div>
      {/* Filters: one row above everything they scope. */}
      <div className="mb-4 flex min-w-0 flex-col gap-2 md:flex-row md:flex-wrap">
          <PillGroup label="Date range">
            {RANGES.map((r) => (
              <Pill key={r.value} href={href({ range: r.value })} active={range.value === r.value}>
                {r.label}
              </Pill>
            ))}
          </PillGroup>
          {multiTeam && (
            <PillGroup label="Team">
              <Pill href={href({ team: null })} active={!teamId}>
                All teams
              </Pill>
              {teams.map((x) => (
                <Pill key={x.id} href={href({ team: x.id })} active={teamId === x.id}>
                  {x.name}
                </Pill>
              ))}
            </PillGroup>
          )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-12 [&>*]:min-w-0">
        {/* Hero */}
        <section className="@container relative overflow-hidden rounded-[1.75rem] border border-[var(--sun-line)] p-6 shadow-[var(--sun-shadow)] [background:var(--sun-hero)] md:col-span-2 sm:p-8 xl:col-span-12">
          <div className="grid items-center gap-6 @3xl:grid-cols-[1fr_auto]">
            <div className="@container min-w-0">
              <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-[2.6rem] sm:leading-[1.1]">
                {greeting()}, {firstName}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                It&apos;s {today()} · {range.label.toLowerCase()} for {scope}
              </p>
              <div className="my-6 h-px max-w-xl bg-gradient-to-r from-[var(--sun-line)] to-transparent" />
              <dl className="grid grid-cols-2 gap-x-6 gap-y-5 @xl:grid-cols-4">
                <Kpi icon={ClipboardList} label="Tasks assigned" value={t.total} />
                <Kpi icon={CheckCircle2} label="Completed" value={t.completed} />
                <Kpi icon={AlertTriangle} label="Overdue now" value={t.overdue} warn={t.overdue > 0} />
                <Kpi icon={Timer} label="Avg. time to finish" value={formatDuration(t.avgCompletionMs)} />
              </dl>
            </div>
            <div className="mx-auto w-full max-w-[300px] @3xl:w-[300px]">
              <Gauge value={t.completionRate} label="Completion rate" detail={`${t.completed} of ${t.total} tasks done`} />
            </div>
          </div>
        </section>

        {/* Highlights (spans two rows on wide screens, like the schedule card) */}
        <div className="md:col-span-2 xl:col-span-4 xl:row-span-2">
          <Highlights tabs={tabs} subtitle={range.label} />
        </div>

        {/* Weekly trend */}
        <SunCard className="md:col-span-1 xl:col-span-5">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg border border-[var(--sun-line)] bg-[var(--sun-raised)]">
                  <CheckCircle2 className="size-3.5 text-muted-foreground" />
                </span>
                <span className="text-[2.1rem] leading-none font-light tracking-tight">{completed8}</span>
                {trend.length >= 8 && (
                  <span className="ml-1 flex items-center gap-0.5 rounded-full border border-[var(--sun-line)] bg-[var(--sun-raised)] px-2 py-0.5 text-[11px] text-muted-foreground">
                    {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                    {delta >= 0 ? "+" : ""}
                    {delta} vs earlier 4 weeks
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">Tasks completed · last 8 weeks</p>
            </div>
            <Link href={tasksHref("COMPLETED")} aria-label="Open completed tasks" className="group">
              <RoundIcon>
                <ArrowUpRight />
              </RoundIcon>
            </Link>
          </div>
          <div className="mb-1 flex justify-end">
            <TrendLegend />
          </div>
          <TrendChart data={trendData} />
        </SunCard>

        {/* Where the work stands */}
        <SunCard className="md:col-span-1 xl:col-span-3">
          <SunCardHeader
            title="Task status"
            action={
              <div className="text-right leading-tight">
                <span className="block text-2xl font-light tracking-tight">{open(t)}</span>
                <span className="text-[11px] text-muted-foreground">open tasks</span>
              </div>
            }
          />
          <StatusColumns
            slices={[
              { key: "done", label: "Passed", count: t.completed, color: "var(--sun-yellow)", onColor: "dark" },
              { key: "review", label: "In review", count: t.inReview, color: "#8b5cf6", onColor: "light" },
              { key: "progress", label: "In progress", count: t.inProgress, color: "var(--sun-charcoal)", onColor: "invert" },
              { key: "pending", label: "Not started", count: t.pending, color: "var(--sun-gray)", onColor: "dark" },
              { key: "overdue", label: "Overdue", count: t.overdue, color: "var(--sun-red)", onColor: "light", warning: true },
            ]}
          />
        </SunCard>

        {/* Quick tiles */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:col-span-2 lg:grid-cols-6 xl:col-span-8">
          <Tile dot="#8b5cf6" label="In review" value={t.inReview} href={tasksHref("SUBMITTED")} />
          <Tile dot="var(--sun-charcoal)" label="In progress" value={t.inProgress} href={tasksHref("IN_PROGRESS")} />
          <Tile dot="var(--sun-gray)" label="Not started" value={t.pending} href={tasksHref("PENDING")} />
          <Tile dot="var(--sun-red)" label="Overdue" value={t.overdue} href={tasksHref("OVERDUE")} />
          <Tile
            dot="var(--sun-yellow)"
            label="Done on time"
            value={t.completedOnTime}
            hint={`${pct(t.onTimeRate)} on-time rate`}
            href={tasksHref("COMPLETED")}
          />
          <Tile
            dot="var(--sun-gray)"
            label="Passed first time"
            value={t.passedFirstTime}
            hint={`${pct(t.firstTimePassRate)} · ${t.completedLate} done late`}
            href={tasksHref("COMPLETED")}
          />
        </div>

        {/* People */}
        <div className="md:col-span-2 xl:col-span-12">
          <PeopleTable rows={rows} />
        </div>
      </div>
    </div>
  );
}

function PillGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <nav
      aria-label={label}
      className="flex w-fit max-w-full min-w-0 flex-wrap gap-1 rounded-[1.25rem] border border-[var(--sun-line)] bg-[var(--sun-surface)]/80 p-1 shadow-[var(--sun-shadow)]"
    >
      {children}
    </nav>
  );
}

function Pill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-[#22211d] text-white dark:bg-[#f4f1e8] dark:text-[#1f1e1b]"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  warn,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dd className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg border border-[var(--sun-line)] bg-[var(--sun-raised)]/80",
            warn && "border-transparent bg-[var(--sun-red)] text-white",
          )}
        >
          <Icon className={cn("size-3.5", !warn && "text-muted-foreground")} />
        </span>
        <KpiValue value={value} />
      </dd>
      <dt className="mt-2 text-sm text-muted-foreground">{label}</dt>
    </div>
  );
}

/** Big light number; a trailing unit ("9.2 days") is set smaller so it fits narrow screens. */
function KpiValue({ value }: { value: React.ReactNode }) {
  const match = typeof value === "string" ? /^([\d.,]+)\s+(.+)$/.exec(value) : null;
  return (
    <span className="text-[2rem] leading-none font-light tracking-tight whitespace-nowrap">
      {match ? (
        <>
          {match[1]}
          <span className="ml-1 text-base text-muted-foreground">{match[2]}</span>
        </>
      ) : (
        value
      )}
    </span>
  );
}

function Tile({
  dot,
  label,
  value,
  hint,
  href,
}: {
  dot: string;
  label: string;
  value: number;
  hint?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col justify-between gap-4 rounded-[1.4rem] border border-[var(--sun-line)] bg-[var(--sun-surface)]/85 p-4 shadow-[var(--sun-shadow)] transition-all hover:-translate-y-0.5"
    >
      <div>
        <span className="mb-3 block size-2.5 rounded-full" style={{ background: dot }} aria-hidden />
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-xl font-normal tracking-tight">
          {value} <span className="text-sm text-muted-foreground">task{value === 1 ? "" : "s"}</span>
        </p>
        {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        View tasks
        <span className="flex size-6 items-center justify-center rounded-lg border border-[var(--sun-line)] bg-[var(--sun-raised)] transition-colors group-hover:border-transparent group-hover:bg-[var(--sun-yellow)] group-hover:text-[#1f1e1b]">
          <ArrowUpRight className="size-3.5" />
        </span>
      </div>
    </Link>
  );
}
