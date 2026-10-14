import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Clock,
  Flame,
  Sun,
} from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { EmptyIllustration } from "@/components/illustrations";
import { ProgressRing } from "@/components/progress-ring";
import { StatCard } from "@/components/stat-card";
import { TaskListItem } from "@/components/tasks/task-list-item";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { WelcomeBanner } from "@/components/welcome-banner";
import { APP_TIMEZONE, formatPercent } from "@/lib/format";
import { computeMetrics } from "@/lib/tasks/metrics";
import { completedOnTime, isOverdue, PRIORITY_RANK } from "@/lib/tasks/rules";
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

  const open = tasks.filter((t) => t.status !== "COMPLETED").sort(byUrgency);
  const overdue = open.filter((t) => isOverdue(t, now));
  const today = open.filter((t) => !isOverdue(t, now) && dayKey(t.dueAt) === todayKey);
  const week = open.filter(
    (t) => !isOverdue(t, now) && dayKey(t.dueAt) !== todayKey && t.dueAt.getTime() <= weekEnd,
  );
  const later = open.filter((t) => t.dueAt.getTime() > weekEnd);

  const completed = tasks
    .filter((t) => t.status === "COMPLETED")
    .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime());
  // On-time streak: consecutive most recent completions that met the deadline.
  let streak = 0;
  for (const t of completed) {
    if (!completedOnTime(t)) break;
    streak++;
  }

  const focusCount = overdue.length + today.length;
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
        aside={tasks.length > 0 && <ProgressRing value={m.completionRate} size={112} label="completed" />}
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
            <StatCard label="Assigned to me" value={m.total} icon={ClipboardList} hint={`${m.pending} not started`} />
            <StatCard label="In progress" value={m.inProgress} icon={CircleDot} tone="blue" />
            <StatCard label="Completed" value={m.completed} icon={CheckCircle2} tone="green" />
            <StatCard label="Overdue" value={m.overdue} icon={AlertTriangle} tone={m.overdue ? "red" : "default"} />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sun className="size-5 text-brand-orange" /> My day
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
                      <p className="text-sm text-muted-foreground">You have no open tasks. Great work.</p>
                    </div>
                  ) : (
                    <>
                      <TaskGroup title="Overdue" icon={AlertTriangle} tone="text-red-600" tasks={overdue} />
                      <TaskGroup title="Due today" icon={Clock} tone="text-brand-orange" tasks={today} />
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
                      <div className="flex size-10 items-center justify-center rounded-full bg-brand-orange text-white">
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
                    detail={`${m.completed} of ${m.total} tasks completed`}
                  />
                  <Meter
                    label="On-time rate"
                    value={m.onTimeRate}
                    detail={`${m.completedOnTime} on time · ${m.completedLate} late`}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recently completed</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {completed.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing completed yet.</p>
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
