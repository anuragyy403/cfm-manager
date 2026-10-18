import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Flame,
  Hourglass,
  RotateCcw,
  Sun,
} from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { EmptyIllustration } from "@/components/illustrations";
import { Gauge } from "@/components/analytics/gauge";
import { StatCard } from "@/components/stat-card";
import { TaskListItem } from "@/components/tasks/task-list-item";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { WelcomeBanner } from "@/components/welcome-banner";
import { APP_TIMEZONE, formatPercent } from "@/lib/format";
import { computeMetrics } from "@/lib/tasks/metrics";
import { changesRequested, completedOnTime, isOpen, isOverdue, PRIORITY_RANK } from "@/lib/tasks/rules";
import { requireEmployee } from "@/server/session";
import { listMyTasks } from "@/server/tasks";

export const metadata: Metadata = { title: "My day" };

/** "2026-10-13" in the company timezone, so "today" means the office's today. */
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(d);

export default async function MemberDashboardPage() {
  const member = await requireEmployee();
  const tasks = await listMyTasks(member);
  const now = new Date();
  const m = computeMetrics(tasks, now);

  const todayKey = dayKey(now);
  const weekEnd = now.getTime() + 7 * 864e5;
  const byUrgency = (a: (typeof tasks)[number], b: (typeof tasks)[number]) =>
    a.dueAt.getTime() - b.dueAt.getTime() || PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];

  // Work still with the employee. Handed-in work waits on the reviewer instead.
  const open = tasks.filter((t) => isOpen(t.status)).sort(byUrgency);
  const sentBack = open.filter((t) => changesRequested(t));
  const fresh = open.filter((t) => !changesRequested(t));
  const overdue = fresh.filter((t) => isOverdue(t, now));
  const today = fresh.filter((t) => !isOverdue(t, now) && dayKey(t.dueAt) === todayKey);
  const week = fresh.filter(
    (t) => !isOverdue(t, now) && dayKey(t.dueAt) !== todayKey && t.dueAt.getTime() <= weekEnd,
  );
  const later = fresh.filter((t) => t.dueAt.getTime() > weekEnd);
  const inReview = tasks
    .filter((t) => t.status === "SUBMITTED")
    .sort((a, b) => a.submittedAt!.getTime() - b.submittedAt!.getTime());

  const completed = tasks
    .filter((t) => t.status === "COMPLETED")
    .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime());
  // On-time streak: consecutive most recent completions that met the deadline.
  let streak = 0;
  for (const t of completed) {
    if (!completedOnTime(t)) break;
    streak++;
  }

  const focusCount = sentBack.length + overdue.length + today.length;
  const subtitle =
    tasks.length === 0
      ? "You don't have any tasks yet. When your manager assigns one, it will appear here."
      : focusCount === 0
        ? `Nothing due today. You have ${open.length} open task${open.length === 1 ? "" : "s"} coming up.`
        : `${focusCount} task${focusCount === 1 ? " needs" : "s need"} your focus today${
            overdue.length ? `, including ${overdue.length} overdue` : ""
          }.`;

  return (
    <>
      <AutoRefresh />
      <WelcomeBanner
        name={member.name}
        subtitle={subtitle}
        actions={
          <Button asChild variant="brand">
            <Link href="/dashboard/tasks">
              All my tasks <ArrowRight />
            </Link>
          </Button>
        }
        aside={tasks.length > 0 && <Gauge value={m.completionRate} label="My completion" detail={`${m.completed} of ${m.total} tasks done`} />}
      />

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <EmptyIllustration kind="tasks" />
            <p className="mt-2 font-semibold">No tasks yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Your manager hasn&apos;t assigned you anything yet. New tasks show up here automatically.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard
              label="Assigned to me"
              value={m.total}
              icon={ClipboardList}
              hint={`${m.inProgress} in progress · ${m.pending} not started`}
            />
            <StatCard
              label="In review"
              value={m.inReview}
              icon={Hourglass}
              tone={m.inReview ? "violet" : "default"}
              hint="Waiting for your manager"
            />
            <StatCard label="Passed" value={m.completed} icon={CheckCircle2} tone="green" hint="Counts as done" />
            <StatCard label="Overdue" value={m.overdue} icon={AlertTriangle} tone={m.overdue ? "red" : "default"} />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="min-w-0 space-y-6 xl:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sun className="size-5 text-sun-deep" /> My day
                  </CardTitle>
                  <CardDescription>What to work on, most urgent first.</CardDescription>
                  <CardAction>
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/dashboard/tasks">
                        View all <ArrowRight />
                      </Link>
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent className="space-y-6">
                  {open.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-6 text-center">
                      <EmptyIllustration kind="done" className="h-24" />
                      <p className="font-medium">All caught up!</p>
                      <p className="text-sm text-muted-foreground">
                        {inReview.length
                          ? "Everything else is with your manager for review."
                          : "You have no open tasks. Great work."}
                      </p>
                    </div>
                  ) : (
                    <>
                      <TaskGroup title="Sent back to you" icon={RotateCcw} tone="text-amber-600" tasks={sentBack} />
                      <TaskGroup title="Overdue" icon={AlertTriangle} tone="text-red-600" tasks={overdue} />
                      <TaskGroup title="Due today" icon={Clock} tone="text-sun-deep" tasks={today} />
                      <TaskGroup title="This week" icon={CalendarClock} tone="text-sky-600" tasks={week} />
                      <TaskGroup title="Later" icon={CalendarDays} tone="text-muted-foreground" tasks={later} />
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>My progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {streak > 0 && (
                    <div className="flex items-center gap-3 rounded-xl bg-brand-orange-soft p-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-sun text-[#1f1e1b]">
                        <Flame className="size-5" />
                      </div>
                      <div className="text-sm">
                        <p className="font-semibold">
                          {streak} on time in a row
                        </p>
                        <p className="text-muted-foreground">Keep the streak going!</p>
                      </div>
                    </div>
                  )}
                  <Meter
                    label="Completion rate"
                    value={m.completionRate}
                    detail={`${m.completed} of ${m.total} tasks passed`}
                  />
                  <Meter
                    label="On-time rate"
                    value={m.onTimeRate}
                    detail={`${m.completedOnTime} on time · ${m.completedLate} late`}
                  />
                  <Meter
                    label="Passed first time"
                    value={m.firstTimePassRate}
                    detail={`${m.passedFirstTime} of ${m.completed} passed without changes`}
                  />
                </CardContent>
              </Card>

              {inReview.length > 0 && (
                <Card className="border-violet-200 dark:border-violet-900">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Hourglass className="size-4 text-violet-600" /> Waiting for review
                    </CardTitle>
                    <CardDescription>Your manager will pass these or send them back.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {inReview.map((t) => (
                      <TaskListItem key={t.id} task={t} href={`/dashboard/tasks/${t.id}`} />
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Recently passed</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {completed.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing passed yet.</p>
                  ) : (
                    completed
                      .slice(0, 4)
                      .map((t) => <TaskListItem key={t.id} task={t} href={`/dashboard/tasks/${t.id}`} />)
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function TaskGroup({
  title,
  icon: Icon,
  tone,
  tasks,
}: {
  title: string;
  icon: typeof Clock;
  tone: string;
  tasks: Awaited<ReturnType<typeof listMyTasks>>;
}) {
  if (tasks.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className={`size-4 ${tone}`} />
        {title}
        <span className="rounded-full bg-muted px-2 text-xs font-medium tabular-nums text-muted-foreground">
          {tasks.length}
        </span>
      </h3>
      <div className="space-y-2">
        {tasks.map((t) => (
          <TaskListItem key={t.id} task={t} href={`/dashboard/tasks/${t.id}`} />
        ))}
      </div>
    </section>
  );
}

function Meter({ label, value, detail }: { label: string; value: number | null; detail: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{formatPercent(value)}</span>
      </div>
      <Progress value={(value ?? 0) * 100} className="h-2 **:data-[slot=progress-indicator]:bg-brand-orange" />
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
