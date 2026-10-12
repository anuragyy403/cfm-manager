import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDot, ClipboardList, Clock, Inbox } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { TaskListItem } from "@/components/tasks/task-list-item";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { formatPercent } from "@/lib/format";
import { computeMetrics } from "@/lib/tasks/metrics";
import { isDueSoon, isOverdue, PRIORITY_RANK } from "@/lib/tasks/rules";
import { requireMember } from "@/server/session";
import { listMyTasks } from "@/server/tasks";

export const metadata: Metadata = { title: "My dashboard" };

export default async function MemberDashboardPage() {
  const member = await requireMember();
  const tasks = await listMyTasks(member);
  const now = new Date();
  const m = computeMetrics(tasks, now);

  const overdue = tasks.filter((t) => isOverdue(t, now));
  const dueSoon = tasks.filter((t) => isDueSoon(t, now));
  const open = tasks
    .filter((t) => t.status !== "COMPLETED" && !isOverdue(t, now) && !isDueSoon(t, now))
    .sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || a.dueAt.getTime() - b.dueAt.getTime());
  const recentlyCompleted = tasks
    .filter((t) => t.status === "COMPLETED")
    .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime())
    .slice(0, 5);
  const urgent = [...overdue, ...dueSoon];

  return (
    <>
      <AutoRefresh />
      <PageHeader
        title={`Hi, ${member.name.split(" ")[0]}`}
        description={
          urgent.length
            ? `You have ${urgent.length} task${urgent.length === 1 ? "" : "s"} that need${urgent.length === 1 ? "s" : ""} attention.`
            : "You're all caught up on urgent work."
        }
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/tasks">
              All my tasks <ArrowRight />
            </Link>
          </Button>
        }
      />

      {tasks.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>No tasks yet</EmptyTitle>
            <EmptyDescription>
              When your manager assigns you a task, it will show up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
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
                  <CardTitle>Needs attention</CardTitle>
                  <CardDescription>Overdue tasks and tasks due in the next 48 hours.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {urgent.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing is overdue or due soon. Nice work.</p>
                  ) : (
                    urgent.map((t) => <TaskListItem key={t.id} task={t} href={`/dashboard/tasks/${t.id}`} />)
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Other open tasks</CardTitle>
                  <CardDescription>Sorted by priority, then deadline.</CardDescription>
                  <CardAction>
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/dashboard/tasks">
                        View all <ArrowRight />
                      </Link>
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent className="space-y-2">
                  {open.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No other open tasks.</p>
                  ) : (
                    open.map((t) => <TaskListItem key={t.id} task={t} href={`/dashboard/tasks/${t.id}`} />)
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>My completion summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Completion rate</span>
                      <span className="font-medium tabular-nums">{formatPercent(m.completionRate)}</span>
                    </div>
                    <Progress value={(m.completionRate ?? 0) * 100} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {m.completed} of {m.total} tasks completed
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="size-3.5" /> On-time rate
                      </span>
                      <span className="font-medium tabular-nums">{formatPercent(m.onTimeRate)}</span>
                    </div>
                    <Progress value={(m.onTimeRate ?? 0) * 100} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {m.completedOnTime} on time · {m.completedLate} late
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recently completed</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {recentlyCompleted.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing completed yet.</p>
                  ) : (
                    recentlyCompleted.map((t) => (
                      <TaskListItem key={t.id} task={t} href={`/dashboard/tasks/${t.id}`} />
                    ))
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
