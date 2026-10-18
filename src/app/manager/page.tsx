import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Briefcase, CheckCircle2, ClipboardList, Hourglass, KanbanSquare, Target } from "lucide-react";
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
import { isOverdue, PRIORITY_RANK } from "@/lib/tasks/rules";
import { getTeamAnalytics } from "@/server/analytics";
import { requireManager } from "@/server/session";
import { listActivity, listAttentionTasks, listMyTasks, listReviewQueue } from "@/server/tasks";
import { listAssignableTeams } from "@/server/teams";

export const metadata: Metadata = { title: "Overview" };

export default async function ManagerOverviewPage() {
  const manager = await requireManager();
  const [analytics, myTasks, attention, activity, assignable, toReview] = await Promise.all([
    getTeamAnalytics(manager),
    listMyTasks(manager),
    listAttentionTasks(manager, 8),
    listActivity(manager, 10),
    listAssignableTeams(manager),
    listReviewQueue(manager),
  ]);

  const myOpen = myTasks
    .filter((t) => t.status !== "COMPLETED")
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime() || PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);
  const now = new Date();
  const myOverdue = myOpen.filter((t) => isOverdue(t, now)).length;

  if (!analytics) {
    return (
      <>
        <WelcomeBanner
          name={manager.name}
          subtitle="You're a manager now. Create your team, add the employees who report to you, and start assigning work."
          actions={<NewTeamButton base="/manager" />}
        />
        <GettingStarted
          steps={[
            { label: "Create your team", description: "Give your team a name. You can run more than one.", done: false, href: "/manager/teams", cta: "Create team" },
            { label: "Add your employees", description: "Search for colleagues who have signed up and add them.", done: false, href: "/manager/teams", cta: "Add employees" },
            { label: "Assign the first task", description: "Create a task, or split work the owner gave you into subtasks.", done: false, href: "/manager/tasks", cta: "Create a task" },
          ]}
        />
        <MyWorkCard tasks={myOpen} overdue={myOverdue} />
      </>
    );
  }

  const m = analytics.team;
  const open = m.pending + m.inProgress + m.overdue;
  const employees = analytics.members.filter((x) => !x.isManager);
  const ranked = [...employees].sort(
    (a, b) => b.metrics.overdue - a.metrics.overdue || (a.metrics.completionRate ?? 1) - (b.metrics.completionRate ?? 1),
  );
  const teamWord = analytics.teams.length === 1 ? analytics.teams[0]!.name : `Your ${analytics.teams.length} teams`;

  return (
    <>
      <AutoRefresh />
      <WelcomeBanner
        name={manager.name}
        subtitle={`${toReview.length ? `${toReview.length} task${toReview.length === 1 ? " is" : "s are"} waiting for your review. ` : ""}${myOpen.length ? `You have ${myOpen.length} task${myOpen.length === 1 ? "" : "s"} of your own${myOverdue ? ` (${myOverdue} overdue)` : ""}. ` : ""}${teamWord} ${
          analytics.teams.length === 1 ? "has" : "have"
        } ${open} open task${open === 1 ? "" : "s"}${m.overdue ? `, ${m.overdue} overdue` : ""}.`}
        actions={
          <>
            <NewTaskButton teams={assignable} base="/manager" />
            <Button asChild variant="outline">
              <Link href="/manager/tasks?layout=board">
                <KanbanSquare />
                Task board
              </Link>
            </Button>
          </>
        }
        aside={<Gauge value={m.completionRate} label="Team completion" detail={`${m.completed} of ${m.total} tasks done`} />}
      />

      <GettingStarted
        steps={[
          { label: "Create your team", description: "Done. Rename it any time from its page.", done: true, href: "/manager/teams", cta: "Open teams" },
          {
            label: "Add your employees",
            description: "Search for colleagues who have signed up and add them.",
            done: employees.length > 0,
            href: "/manager/teams",
            cta: "Add employees",
          },
          {
            label: "Assign the first task",
            description: "Create a task, or split work the owner gave you into subtasks.",
            done: m.total > myTasks.length,
            href: "/manager/tasks",
            cta: "Create a task",
          },
        ]}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Team tasks"
          value={m.total}
          icon={ClipboardList}
          hint={`${m.inProgress} in progress · ${m.pending} not started`}
        />
        <StatCard
          label="To review"
          value={toReview.length}
          icon={Hourglass}
          tone={toReview.length ? "violet" : "default"}
          hint={m.inReview > toReview.length ? `${m.inReview} in review in total` : "Handed in, waiting for you"}
        />
        <StatCard label="Overdue" value={m.overdue} icon={AlertTriangle} tone={m.overdue ? "red" : "default"} />
        <StatCard
          label="Completion rate"
          value={formatPercent(m.completionRate)}
          icon={Target}
          tone="orange"
          hint={`${m.completed} passed`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <ReviewQueueCard
            tasks={toReview}
            base="/manager"
            description="Your team handed these in. Check each one and pass it, or fail it with feedback."
          />
          <MyWorkCard tasks={myOpen} overdue={myOverdue} />

          <Card>
            <CardHeader>
              <CardTitle>Needs attention</CardTitle>
              <CardDescription>Open team tasks that are overdue or due in the next 48 hours.</CardDescription>
              <CardAction>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/manager/tasks?view=OVERDUE">
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
                    href={`/manager/tasks/${t.id}`}
                    assignee={t.assignee}
                    context={analytics.teams.length > 1 ? t.team.name : undefined}
                  />
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Team at a glance</CardTitle>
              <CardDescription>Employees with overdue work or low completion appear first.</CardDescription>
              <CardAction>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/manager/analytics">
                    Full analytics <ArrowRight />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {ranked.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <EmptyIllustration kind="team" className="h-24" />
                  <p className="text-sm text-muted-foreground">
                    No employees yet.{" "}
                    <Link href="/manager/teams" className="font-medium text-brand-orange-hover hover:underline">
                      Add your team
                    </Link>
                  </p>
                </div>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {ranked.map(({ user, metrics, team }) => (
                    <li key={`${team.id}:${user.id}`}>
                      <Link
                        href={`/manager/people/${user.id}`}
                        className="flex items-center gap-3 rounded-xl border p-3 transition-all hover:-translate-y-px hover:shadow-md"
                      >
                        <UserAvatar name={user.name} id={user.id} size="md" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium">{user.name}</span>
                            {metrics.overdue > 0 ? (
                              <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                                {metrics.overdue} overdue
                              </span>
                            ) : (
                              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                {metrics.completed}/{metrics.total} done
                              </span>
                            )}
                          </div>
                          {analytics.teams.length > 1 && (
                            <p className="truncate text-xs text-muted-foreground">{team.name}</p>
                          )}
                          <Progress
                            value={(metrics.completionRate ?? 0) * 100}
                            className="mt-2 h-1.5 **:data-[slot=progress-indicator]:bg-brand-orange"
                          />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest updates from your team.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityFeed activities={activity} taskHref={(id) => `/manager/tasks/${id}`} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/** The manager's own open tasks (usually from the owner), most urgent first. */
function MyWorkCard({ tasks, overdue }: { tasks: Awaited<ReturnType<typeof listMyTasks>>; overdue: number }) {
  return (
    <Card className="border-brand-orange/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="size-5 text-sun-deep" /> My work
        </CardTitle>
        <CardDescription>
          {tasks.length === 0
            ? "Tasks assigned to you personally show up here."
            : `${tasks.length} open task${tasks.length === 1 ? "" : "s"} assigned to you${overdue ? `, ${overdue} overdue` : ""}. Open one to start it or split it into subtasks.`}
        </CardDescription>
        <CardAction>
          <Button asChild variant="ghost" size="sm">
            <Link href="/manager/my-tasks">
              All my tasks <ArrowRight />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            <CheckCircle2 className="size-5 text-emerald-600" />
            Nothing assigned to you right now.
          </div>
        ) : (
          tasks
            .slice(0, 5)
            .map((t) => (
              <TaskListItem
                key={t.id}
                task={t}
                href={`/manager/tasks/${t.id}`}
                context={t._count.subtasks > 0 ? `${t._count.subtasks} subtask${t._count.subtasks === 1 ? "" : "s"}` : t.team.name}
              />
            ))
        )}
      </CardContent>
    </Card>
  );
}
