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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { formatDate, formatDuration, formatPercent } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/roles";
import { isOwner } from "@/server/access";
import { getPersonOverview } from "@/server/people";
import type { CurrentUser } from "@/server/session";
import { listAssignableTeams } from "@/server/teams";
import { NewTaskButton } from "../new-task-button";
import { RoleButton } from "../role-button";
import { SendResetButton } from "../send-reset-button";

/** Everything about one person: role, team, metrics, tasks and recent activity. */
export async function PersonView({ viewer, base, userId }: { viewer: CurrentUser; base: string; userId: string }) {
  const owner = isOwner(viewer);
  const { user, team, joinedAt, onViewersTeam, tasks, metrics, activities } = await getPersonOverview(viewer, userId);

  // Teams this person can get new work in, so "New task" can preselect them.
  const assignable = (await listAssignableTeams(viewer)).filter((t) => t.people.some((p) => p.id === user.id));
  const isSelf = user.id === viewer.id;
  const subtitle =
    user.role === "MANAGER"
      ? user.managedTeams.length
        ? `Manages ${user.managedTeams.map((t) => t.name).join(", ")}`
        : "Not running a team yet"
      : user.role === "MEMBER"
        ? team
          ? `On ${team.name}${joinedAt ? ` since ${formatDate(joinedAt)}` : ""}`
          : "Not on a team yet"
        : "Company owner";

  return (
    <>
      <AutoRefresh />
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4">
        <Link href={owner ? `${base}/people` : team ? `${base}/teams/${team.id}` : `${base}/teams`}>
          <ArrowLeft />
          {owner ? "People" : (team?.name ?? "Teams")}
        </Link>
      </Button>

      <div className="relative mb-6 overflow-hidden rounded-2xl border bg-card p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-r from-sun-soft via-[#f8e39a] to-sun" />
        <div className="relative flex flex-col gap-4 pt-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <UserAvatar name={user.name} id={user.id} size="lg" className="size-20 text-2xl ring-4 ring-card" />
            <div className="min-w-0 space-y-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
                <Badge variant={user.role === "MEMBER" ? "secondary" : "default"}>{ROLE_LABELS[user.role]}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {user.username && `@${user.username} · `}
                {user.email}
              </p>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          {!isSelf && (onViewersTeam || owner) && (
            <div className="flex flex-wrap items-center gap-2">
              {owner && user.role !== "ADMIN" && (
                <RoleButton userId={user.id} name={user.name} role={user.role} teamName={team?.name} />
              )}
              {user.role !== "ADMIN" && <SendResetButton userId={user.id} name={user.name} email={user.email} />}
              {assignable.length > 0 && (
                <NewTaskButton
                  teams={assignable}
                  base={base}
                  defaultAssigneeId={user.id}
                  label={`New task for ${user.name.split(" ")[0]}`}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {!owner && !onViewersTeam && (
        <Alert className="mb-6">
          <AlertTitle>No longer on your team</AlertTitle>
          <AlertDescription>
            {user.name} left your team. Their task history with you is kept for reporting.
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
              <TaskTable tasks={tasks} base={base} showAssignee={false} showTeam={owner} />
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
              taskHref={(id) => `${base}/tasks/${id}`}
              emptyText={`${user.name} hasn't updated any tasks yet.`}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
