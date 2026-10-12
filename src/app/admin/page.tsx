import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Clock,
  Target,
  Users,
} from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ActivityFeed } from "@/components/tasks/activity-feed";
import { TaskListItem } from "@/components/tasks/task-list-item";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { formatPercent, initials } from "@/lib/format";
import { getTeamAnalytics } from "@/server/analytics";
import { requireAdmin } from "@/server/session";
import { listAttentionTasks, listTeamActivity } from "@/server/tasks";
import { getAdminTeam, listTeamMembers } from "@/server/teams";
import { NewTaskButton } from "./tasks/new-task-button";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  const admin = await requireAdmin();
  const team = await getAdminTeam(admin);

  if (!team) {
    return (
      <>
        <PageHeader title={`Welcome, ${admin.name.split(" ")[0]}`} />
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>Set up your team</EmptyTitle>
            <EmptyDescription>
              Create your team and add the people who work with you. Then you can start assigning tasks.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/admin/team">Create team</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </>
    );
  }

  const [analytics, attention, activity, members] = await Promise.all([
    getTeamAnalytics(admin),
    listAttentionTasks(admin),
    listTeamActivity(admin, 10),
    listTeamMembers(team.id),
  ]);
  const m = analytics!.team;
  const memberOptions = members.map((x) => ({ id: x.user.id, name: x.user.name, username: x.user.username }));
  const ranked = [...analytics!.members].sort(
    (a, b) => b.metrics.overdue - a.metrics.overdue || (a.metrics.completionRate ?? 1) - (b.metrics.completionRate ?? 1),
  );

  return (
    <>
      <AutoRefresh />
      <PageHeader
        title={`Welcome, ${admin.name.split(" ")[0]}`}
        description={`Here's how ${team.name} is doing right now.`}
        actions={<NewTaskButton members={memberOptions} />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Total tasks" value={m.total} icon={ClipboardList} hint={`${m.pending} pending`} />
        <StatCard label="In progress" value={m.inProgress} icon={CircleDot} tone="blue" />
        <StatCard label="Completed" value={m.completed} icon={CheckCircle2} tone="green" />
        <StatCard label="Overdue" value={m.overdue} icon={AlertTriangle} tone={m.overdue ? "red" : "default"} />
        <StatCard label="Completion rate" value={formatPercent(m.completionRate)} icon={Target} />
        <StatCard
          label="On-time rate"
          value={formatPercent(m.onTimeRate)}
          icon={Clock}
          tone="amber"
          hint={`${m.completedLate} completed late`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Needs attention</CardTitle>
              <CardDescription>Open tasks that are overdue or due in the next 48 hours.</CardDescription>
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
                <p className="text-sm text-muted-foreground">Nothing urgent. Every open task is on track.</p>
              ) : (
                attention.map((t) => (
                  <TaskListItem key={t.id} task={t} href={`/admin/tasks/${t.id}`} subtitle={t.assignee.name} />
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Team at a glance</CardTitle>
              <CardDescription>Members with overdue work or low completion appear first.</CardDescription>
              <CardAction>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin/analytics">
                    Full analytics <ArrowRight />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {ranked.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No members yet. <Link href="/admin/team" className="text-primary hover:underline">Add your team</Link>.
                </p>
              ) : (
                <ul className="divide-y">
                  {ranked.map(({ user, metrics }) => (
                    <li key={user.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <Avatar className="size-8">
                        <AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <Link href={`/admin/team/${user.id}`} className="truncate text-sm font-medium hover:underline">
                            {user.name}
                          </Link>
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {metrics.completed}/{metrics.total} done
                            {metrics.overdue > 0 && (
                              <span className="ml-2 font-medium text-red-600 dark:text-red-400">
                                {metrics.overdue} overdue
                              </span>
                            )}
                          </span>
                        </div>
                        <Progress value={(metrics.completionRate ?? 0) * 100} className="mt-1.5 h-1.5" />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest updates from your team.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityFeed activities={activity} taskHref={(id) => `/admin/tasks/${id}`} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
