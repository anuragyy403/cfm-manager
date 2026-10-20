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
import { UserAvatar } from "@/components/user-avatar";
import { WelcomeBanner } from "@/components/welcome-banner";
import { NewTaskButton } from "@/components/workspace/new-task-button";
import { ReviewQueueCard } from "@/components/workspace/review-queue-card";
import { sumMetrics, TeamGlanceCard } from "@/components/workspace/team-glance-card";
import { NewTeamButton } from "@/components/workspace/team-dialogs";
import { formatPercent } from "@/lib/format";
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

      <div className="space-y-6">
        {/* 1. Teams first: the owner sees each team at a glance and opens the one to check. */}
        <Card>
          <CardHeader>
            <CardTitle>Teams at a glance</CardTitle>
            <CardDescription>Teams with overdue work or low completion come first. Open a team to see what&apos;s happening.</CardDescription>
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
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {rankedTeams.map((t) => (
                  <li key={t.id}>
                    <TeamGlanceCard team={t} viewerId={owner.id} base="/admin" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 2. Company-wide numbers. */}
        <section aria-labelledby="records-heading">
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <h2 id="records-heading" className="font-semibold">
                All records
              </h2>
              <p className="text-sm text-muted-foreground">Every team&apos;s active tasks together.</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/analytics">
                Analytics <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 2xl:grid-cols-6">
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
        </section>

        {/* Only when a manager's own work is waiting for the owner. */}
        <ReviewQueueCard
          tasks={toReview}
          base="/admin"
          description="Your managers' own work. Their teams' work is reviewed by the managers."
        />

        {/* 3. What needs the owner's attention. */}
        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
            <CardDescription>Open tasks across every team that are overdue or due in the next 48 hours.</CardDescription>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/tasks?view=OVERDUE">
                  Overdue <ArrowRight />
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
                <TaskListItem key={t.id} task={t} href={`/admin/tasks/${t.id}`} assignee={t.assignee} context={t.team.name} />
              ))
            )}
          </CardContent>
        </Card>

        {/* 4. The managers. */}
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
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {managers.map((p) => {
                  const pm = p.metrics;
                  const open = pm.pending + pm.inProgress + pm.overdue;
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/admin/people/${p.id}`}
                        className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-all hover:-translate-y-px hover:shadow-md"
                      >
                        <UserAvatar name={p.name} id={p.id} size="md" />
                        <div className="grid min-w-0 flex-1 gap-0.5 leading-tight">
                          <span className="truncate font-medium">{p.name}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {p.managedTeams.length ? p.managedTeams.map((t) => t.name).join(", ") : "No team yet"}
                          </span>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-xs text-muted-foreground tabular-nums">{open} open</span>
                          {pm.overdue > 0 && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                              {pm.overdue} overdue
                            </span>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 5. Latest updates. */}
        <Card>
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
