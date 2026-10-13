import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Clock,
  Timer,
} from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { StatCard } from "@/components/stat-card";
import { ActivityFeed } from "@/components/tasks/activity-feed";
import { TaskTable } from "@/components/tasks/task-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { formatDate, formatDuration, formatPercent } from "@/lib/format";
import { getMemberOverview } from "@/server/members";
import { requireAdmin } from "@/server/session";
import { getAdminTeam, listMemberOptions } from "@/server/teams";
import { NewTaskButton } from "../../tasks/new-task-button";

export const metadata: Metadata = { title: "Member" };

export default async function MemberProfilePage({ params }: PageProps<"/admin/team/[userId]">) {
  const admin = await requireAdmin();
  const { userId } = await params;
  const { user, joinedAt, isMember, tasks, metrics, activities } = await getMemberOverview(admin, userId);
  const team = await getAdminTeam(admin);
  const memberOptions = team ? await listMemberOptions(team.id) : [];

  return (
    <>
      <AutoRefresh />
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4">
        <Link href="/admin/team">
          <ArrowLeft />
          Team
        </Link>
      </Button>

      <div className="relative mb-6 overflow-hidden rounded-2xl border bg-card p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-r from-brand-navy to-brand-navy-soft" />
        <div className="relative flex flex-col gap-4 pt-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <UserAvatar name={user.name} id={user.id} size="lg" className="size-20 text-2xl ring-4 ring-card" />
            <div className="min-w-0 pb-1">
              <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
              <p className="text-sm text-muted-foreground">
                {user.username && `@${user.username} · `}
                {user.email}
                {joinedAt && ` · on the team since ${formatDate(joinedAt)}`}
              </p>
            </div>
          </div>
          {isMember && (
            <NewTaskButton
              members={memberOptions}
              defaultAssigneeId={user.id}
              label={`New task for ${user.name.split(" ")[0]}`}
            />
          )}
        </div>
      </div>

      {!isMember && (
        <Alert className="mb-6">
          <AlertTitle>Former team member</AlertTitle>
          <AlertDescription>
            {user.name} was removed from the team. Their task history is kept for reporting.
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Assigned" value={metrics.total} icon={ClipboardList} hint={`${metrics.pending} pending`} />
        <StatCard label="In progress" value={metrics.inProgress} icon={CircleDot} tone="blue" />
        <StatCard
          label="Completed"
          value={metrics.completed}
          icon={CheckCircle2}
          tone="green"
          hint={`${formatPercent(metrics.completionRate)} completion rate`}
        />
        <StatCard
          label="Overdue"
          value={metrics.overdue}
          icon={AlertTriangle}
          tone={metrics.overdue ? "red" : "default"}
        />
        <StatCard
          label="On-time rate"
          value={formatPercent(metrics.onTimeRate)}
          icon={Clock}
          tone="amber"
          hint={`${metrics.completedOnTime} on time · ${metrics.completedLate} late`}
        />
        <StatCard
          label="Avg. time to complete"
          value={formatDuration(metrics.avgCompletionMs)}
          icon={Timer}
          hint="From assignment to completion"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {tasks.length === 0 ? (
              <p className="px-6 text-sm text-muted-foreground">No tasks assigned yet.</p>
            ) : (
              <TaskTable tasks={tasks} showAssignee={false} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed
              activities={activities}
              taskHref={(id) => `/admin/tasks/${id}`}
              emptyText={`${user.name} hasn't updated any tasks yet.`}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
