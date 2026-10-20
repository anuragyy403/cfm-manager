import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  Clock,
  Hourglass,
  KanbanSquare,
  Target,
} from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { EmptyIllustration } from "@/components/illustrations";
import { Gauge } from "@/components/analytics/gauge";
import { StatCard } from "@/components/stat-card";
import { ActivityFeed } from "@/components/tasks/activity-feed";
import { TaskListItem } from "@/components/tasks/task-list-item";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WelcomeBanner } from "@/components/welcome-banner";
import { NewTaskButton } from "@/components/workspace/new-task-button";
import { ReviewQueueCard } from "@/components/workspace/review-queue-card";
import { sumMetrics, TeamGlanceCard } from "@/components/workspace/team-glance-card";
import { formatPercent } from "@/lib/format";
import { isOpen, isOverdue, PRIORITY_RANK } from "@/lib/tasks/rules";
import { requireHR } from "@/server/session";
import { listActivity, listAttentionTasks, listMyTasks, listReviewQueue } from "@/server/tasks";
import { listAssignableTeams, listTeamsWithMetrics } from "@/server/teams";

export const metadata: Metadata = { title: "Overview" };

/**
 * HR's overview: every team at a glance first (like the owner's), then the
 * company's numbers, work waiting for HR's review, what needs attention, the
 * work the owner gave HR, and recent activity.
 */
export default async function HROverviewPage() {
  const hr = await requireHR();
  const [teams, attention, activity, assignable, toReview, myTasks] = await Promise.all([
    listTeamsWithMetrics(hr),
    listAttentionTasks(hr, 8),
    listActivity(hr, 12),
    listAssignableTeams(hr),
    listReviewQueue(hr),
    listMyTasks(hr),
  ]);

  const m = sumMetrics(teams.map((t) => t.metrics));
  const open = m.pending + m.inProgress + m.overdue;
  const rankedTeams = [...teams].sort(
    (a, b) => b.metrics.overdue - a.metrics.overdue || (a.metrics.completionRate ?? 1) - (b.metrics.completionRate ?? 1),
  );
  const now = new Date();
  const myOpen = myTasks
    .filter((t) => isOpen(t.status) || t.status === "SUBMITTED")
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime() || PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);
  const myOverdue = myOpen.filter((t) => isOverdue(t, now)).length;

  return (
    <>
      <AutoRefresh />
      <WelcomeBanner
        name={hr.name}
        subtitle={
          teams.length === 0
            ? "No teams yet. The owner sets up teams; once they exist you can assign work in any of them."
            : `${toReview.length ? `${toReview.length} task${toReview.length === 1 ? " is" : "s are"} waiting for your review. ` : ""}${
                teams.length
              } team${teams.length === 1 ? "" : "s"} with ${open} open task${open === 1 ? "" : "s"}${
                m.overdue ? `, ${m.overdue} overdue` : ""
              }.`
        }
        actions={
          <>
            <NewTaskButton teams={assignable} base="/hr" />
            <Button asChild variant="outline">
              <Link href="/hr/tasks?layout=board">
                <KanbanSquare />
                Task board
              </Link>
            </Button>
          </>
        }
        aside={
          teams.length > 0 && (
            <Gauge value={m.completionRate} label="Company completion" detail={`${m.completed} of ${m.total} tasks done`} />
          )
        }
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Teams at a glance</CardTitle>
            <CardDescription>
              Teams with overdue work or low completion come first. Open a team to see what&apos;s happening.
            </CardDescription>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link href="/hr/teams">
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
                    <TeamGlanceCard team={t} viewerId={hr.id} base="/hr" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <section aria-labelledby="records-heading">
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <h2 id="records-heading" className="font-semibold">
                All records
              </h2>
              <p className="text-sm text-muted-foreground">Every team&apos;s active tasks together.</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/hr/analytics">
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
            <StatCard label="Passed" value={m.completed} icon={CheckCircle2} tone="green" />
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

        <ReviewQueueCard
          tasks={toReview}
          base="/hr"
          description="Work you gave out, and your HR team's work, handed in and waiting for a pass or fail."
        />

        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
            <CardDescription>Open tasks across every team that are overdue or due in the next 48 hours.</CardDescription>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link href="/hr/tasks?view=OVERDUE">
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
                <TaskListItem key={t.id} task={t} href={`/hr/tasks/${t.id}`} assignee={t.assignee} context={t.team.name} />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-brand-orange/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="size-5 text-sun-deep" /> My work
            </CardTitle>
            <CardDescription>
              {myOpen.length === 0
                ? "Work the owner gives you shows up here."
                : `${myOpen.length} open task${myOpen.length === 1 ? "" : "s"} from the owner${myOverdue ? `, ${myOverdue} overdue` : ""}.`}
            </CardDescription>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link href="/hr/my-tasks">
                  All my tasks <ArrowRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            {myOpen.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                <CheckCircle2 className="size-5 text-emerald-600" />
                Nothing assigned to you right now.
              </div>
            ) : (
              myOpen.slice(0, 5).map((t) => <TaskListItem key={t.id} task={t} href={`/hr/tasks/${t.id}`} />)
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest updates from every team.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityFeed activities={activity} taskHref={(id) => `/hr/tasks/${id}`} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
