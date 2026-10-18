import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  Hourglass,
  KanbanSquare,
  Target,
  Users,
} from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { GettingStarted } from "@/components/getting-started";
import { EmptyIllustration } from "@/components/illustrations";
import { Gauge } from "@/components/analytics/gauge";
import { StatCard } from "@/components/stat-card";
import { ActivityFeed } from "@/components/tasks/activity-feed";
import { TaskListItem } from "@/components/tasks/task-list-item";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { UserAvatar } from "@/components/user-avatar";
import { WelcomeBanner } from "@/components/welcome-banner";
import { NewTaskButton } from "@/components/workspace/new-task-button";
import { ReviewQueueCard } from "@/components/workspace/review-queue-card";
import { NewTeamButton } from "@/components/workspace/team-dialogs";
import { formatPercent } from "@/lib/format";
import { computeMetrics } from "@/lib/tasks/metrics";
import { listPeople } from "@/server/people";
import { requireOwner } from "@/server/session";
import { listActivity, listAttentionTasks, listReviewQueue } from "@/server/tasks";
import { listAssignableTeams, listManagerCandidates, listTeamsWithMetrics } from "@/server/teams";

export const metadata: Metadata = { title: "Overview" };

export default async function OwnerOverviewPage() {
  const owner = await requireOwner();
  const [teams, people, attention, activity, assignable, managerCandidates, toReview] = await Promise.all([
    listTeamsWithMetrics(owner),
    listPeople(owner),
    listAttentionTasks(owner, 8),
    listActivity(owner, 12),
    listAssignableTeams(owner),
    listManagerCandidates(),
    listReviewQueue(owner),
  ]);

  const managers = people.filter((p) => p.role === "MANAGER");
  const employees = people.filter((p) => p.role === "MEMBER");
  // Company-wide numbers are the sum of every team's tasks.
  const m = sumMetrics(teams.map((t) => t.metrics));
  const open = m.pending + m.inProgress + m.overdue;
  const rankedTeams = [...teams].sort(
    (a, b) => b.metrics.overdue - a.metrics.overdue || (a.metrics.completionRate ?? 1) - (b.metrics.completionRate ?? 1),
  );

  const steps = [
    {
      label: "Create your teams",
      description: "Add teams like Tech and Business, and choose who manages each one.",
      done: teams.length > 0,
      href: "/admin/teams",
      cta: "Create a team",
    },
    {
      label: "Add your people",
      description: "Put employees on teams, or let managers add their own.",
      done: teams.some((t) => t._count.members > 0),
      href: "/admin/teams",
      cta: "Open teams",
    },
    {
      label: "Assign the first task",
      description: "Give work to a manager or straight to an employee.",
      done: m.total > 0,
      href: "/admin/tasks",
      cta: "Create a task",
    },
  ];

  return (
    <>
      <AutoRefresh />
      <WelcomeBanner
        name={owner.name}
        subtitle={
          teams.length === 0
            ? "Welcome to CFM Workplace. Create your teams and choose their managers to get started."
            : `${teams.length} team${teams.length === 1 ? "" : "s"}, ${managers.length} manager${
                managers.length === 1 ? "" : "s"
              } and ${employees.length} employee${employees.length === 1 ? "" : "s"}. ${open} open task${
                open === 1 ? "" : "s"
              }${m.overdue ? `, ${m.overdue} overdue` : ""}.`
        }
        actions={
          <>
            {teams.length === 0 ? (
              <NewTeamButton base="/admin" managers={managerCandidates} />
            ) : (
              <NewTaskButton teams={assignable} base="/admin" />
            )}
            <Button asChild variant="outline">
              <Link href="/admin/tasks?layout=board">
                <KanbanSquare />
                Task board
              </Link>
            </Button>
          </>
        }
        aside={teams.length > 0 && <Gauge value={m.completionRate} label="Company completion" detail={`${m.completed} of ${m.total} tasks done`} />}
      />

      <GettingStarted steps={steps} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Total tasks"
          value={m.total}
          icon={ClipboardList}
          hint={`${m.inProgress} in progress · ${m.pending} not started`}
        />
        <StatCard
          label="In review"
          value={m.inReview}
          icon={Hourglass}
          tone={m.inReview ? "violet" : "default"}
          hint={toReview.length ? `${toReview.length} waiting for you` : "Handed in, being checked"}
        />
        <StatCard label="Passed" value={m.completed} icon={CheckCircle2} tone="green" hint={`${formatPercent(m.firstTimePassRate)} first time`} />
        <StatCard label="Overdue" value={m.overdue} icon={AlertTriangle} tone={m.overdue ? "red" : "default"} />
        <StatCard label="Completion rate" value={formatPercent(m.completionRate)} icon={Target} tone="orange" />
        <StatCard
          label="On-time rate"
          value={formatPercent(m.onTimeRate)}
          icon={Clock}
          tone="amber"
          hint={`${m.completedLate} completed late`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <ReviewQueueCard
            tasks={toReview}
            base="/admin"
            description="Your managers' own work. Their teams' work is reviewed by the managers."
          />
          <Card>
            <CardHeader>
              <CardTitle>Teams at a glance</CardTitle>
              <CardDescription>Teams with overdue work or low completion appear first.</CardDescription>
              <CardAction>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin/teams">
                    All teams <ArrowRight />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {rankedTeams.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <EmptyIllustration kind="team" className="h-24" />
                  <p className="text-sm text-muted-foreground">No teams yet.</p>
                </div>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {rankedTeams.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/admin/teams/${t.id}`}
                        className="flex flex-col gap-3 rounded-xl border p-4 transition-all hover:-translate-y-px hover:shadow-md"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">{t.name}</span>
                          {t.metrics.overdue > 0 ? (
                            <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                              {t.metrics.overdue} overdue
                            </span>
                          ) : (
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                              {t.metrics.completed}/{t.metrics.total} done
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <UserAvatar name={t.manager.name} id={t.manager.id} size="xs" />
                          <span className="truncate">
                            {t.manager.id === owner.id ? "Managed by you" : t.manager.name}
                          </span>
                          <span className="ml-auto flex items-center gap-1">
                            <Users className="size-3.5" />
                            {t._count.members}
                          </span>
                        </div>
                        <Progress
                          value={(t.metrics.completionRate ?? 0) * 100}
                          className="h-1.5 **:data-[slot=progress-indicator]:bg-brand-orange"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Needs attention</CardTitle>
              <CardDescription>Open tasks across every team that are overdue or due in the next 48 hours.</CardDescription>
              <CardAction>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin/tasks?view=OVERDUE">
                    Overdue tasks <ArrowRight />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-2">
              {attention.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <EmptyIllustration kind="done" className="h-24" />
                  <p className="font-medium">Nothing urgent</p>
                  <p className="text-sm text-muted-foreground">Every open task is on track.</p>
                </div>
              ) : (
                attention.map((t) => (
                  <TaskListItem
                    key={t.id}
                    task={t}
                    href={`/admin/tasks/${t.id}`}
                    assignee={t.assignee}
                    context={t.team.name}
                  />
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Managers</CardTitle>
              <CardDescription>Each manager&apos;s teams and the work assigned to them personally.</CardDescription>
              <CardAction>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin/people">
                    All people <ArrowRight />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {managers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No managers yet. Promote an employee from{" "}
                  <Link href="/admin/people" className="font-medium text-brand-orange-hover hover:underline">
                    People
                  </Link>{" "}
                  or from a team&apos;s page.
                </p>
              ) : (
                <ul className="-mx-2 divide-y divide-sun-line/70">
                  {managers.map((p) => {
                    const pm = p.metrics;
                    return (
                      <li key={p.id} className="py-1.5 first:pt-0 last:pb-0">
                        <Link
                          href={`/admin/people/${p.id}`}
                          className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-sun-raised"
                        >
                          <UserAvatar name={p.name} id={p.id} />
                          <div className="grid min-w-0 flex-1 gap-0.5 leading-tight">
                            <span className="truncate font-medium">{p.name}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {p.managedTeams.length ? p.managedTeams.map((t) => t.name).join(", ") : "No team yet"}
                            </span>
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {pm.pending + pm.inProgress + pm.overdue} open
                          </span>
                          {pm.overdue > 0 && (
                            <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                              {pm.overdue} overdue
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest updates from every team.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityFeed activities={activity} taskHref={(id) => `/admin/tasks/${id}`} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/** Adds up team metrics into one company-wide set (rates recomputed from the totals). */
function sumMetrics(list: ReturnType<typeof computeMetrics>[]) {
  const total = computeMetrics([]);
  let completionMs = 0;
  for (const x of list) {
    total.total += x.total;
    total.completed += x.completed;
    total.inReview += x.inReview;
    total.inProgress += x.inProgress;
    total.pending += x.pending;
    total.overdue += x.overdue;
    total.completedOnTime += x.completedOnTime;
    total.completedLate += x.completedLate;
    total.passedFirstTime += x.passedFirstTime;
    completionMs += (x.avgCompletionMs ?? 0) * x.completed;
  }
  total.completionRate = total.total ? total.completed / total.total : null;
  total.onTimeRate = total.completed ? total.completedOnTime / total.completed : null;
  total.firstTimePassRate = total.completed ? total.passedFirstTime / total.completed : null;
  total.avgCompletionMs = total.completed ? completionMs / total.completed : null;
  return total;
}
