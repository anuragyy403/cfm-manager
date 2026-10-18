import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleDot, ClipboardList, Target } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { EmptyIllustration } from "@/components/illustrations";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserAvatar } from "@/components/user-avatar";
import { formatDate, formatPercent } from "@/lib/format";
import type { TaskMetrics } from "@/lib/tasks/metrics";
import { isOwner } from "@/server/access";
import { getTeamAnalytics } from "@/server/analytics";
import type { CurrentUser } from "@/server/session";
import { getTeam, listAssignableTeams, listManagerCandidates } from "@/server/teams";
import { AddMember } from "../add-member";
import { MemberActions } from "../member-actions";
import { NewTaskButton } from "../new-task-button";
import { ChangeManagerDialog, EditTeamDialog } from "../team-dialogs";

/** One team: its manager, employees and how each of them is doing. */
export async function TeamDetailView({ viewer, base, teamId }: { viewer: CurrentUser; base: string; teamId: string }) {
  const owner = isOwner(viewer);
  const team = await getTeam(viewer, teamId);
  const [analytics, assignable, managers] = await Promise.all([
    getTeamAnalytics(viewer, { teamId }),
    listAssignableTeams(viewer, teamId),
    owner ? listManagerCandidates() : Promise.resolve([]),
  ]);
  const t = analytics!.team;
  const managerRow = analytics!.members.find((m) => m.isManager);
  const employees = analytics!.members.filter((m) => !m.isManager);
  // Did work in this team but are no longer on it: their work here stays visible.
  const formerMembers = analytics!.people.filter((p) => p.currentTeams.length === 0 && p.metrics.total > 0);

  return (
    <>
      <AutoRefresh />
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4">
        <Link href={`${base}/teams`}>
          <ArrowLeft />
          Teams
        </Link>
      </Button>

      <PageHeader
        title={team.name}
        description={team.description ?? `${employees.length} employee${employees.length === 1 ? "" : "s"}`}
        actions={
          <>
            <EditTeamDialog team={team} base={base} />
            {owner && (
              <ChangeManagerDialog
                teamId={team.id}
                currentManagerId={team.managerId}
                managers={managers}
                employees={employees.map((e) => ({ id: e.user.id, name: e.user.name }))}
              />
            )}
            <AddMember teamId={team.id} canMove={owner} />
            <NewTaskButton teams={assignable} base={base} defaultTeamId={team.id} variant="outline" />
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Open tasks" value={t.pending + t.inProgress + t.overdue} icon={ClipboardList} hint={`${t.pending} not started`} />
        <StatCard label="In progress" value={t.inProgress} icon={CircleDot} tone="blue" />
        <StatCard label="Overdue" value={t.overdue} icon={AlertTriangle} tone={t.overdue ? "red" : "default"} />
        <StatCard
          label="Completion rate"
          value={formatPercent(t.completionRate)}
          icon={Target}
          tone="orange"
          hint={`${t.completed} completed`}
        />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Manager</CardTitle>
          <CardDescription>
            Sees all of {team.name}&apos;s work, assigns tasks and splits them into subtasks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <UserAvatar name={team.manager.name} id={team.manager.id} size="md" />
            <div className="grid min-w-0 flex-1 leading-tight">
              <span className="font-medium">
                {team.manager.name}
                {team.manager.id === viewer.id && " (you)"}
              </span>
              <span className="text-sm text-muted-foreground">
                {team.manager.role === "ADMIN" ? "Owner, managing this team directly" : team.manager.email}
              </span>
            </div>
            {managerRow && <MiniMetrics metrics={managerRow.metrics} />}
            {owner && team.manager.role === "MANAGER" && (
              <Button asChild variant="ghost" size="sm">
                <Link href={`${base}/people/${team.manager.id}`}>View profile</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employees</CardTitle>
          <CardDescription>
            {employees.length} {employees.length === 1 ? "person" : "people"} on this team. Click a name to see their
            tasks and activity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <EmptyIllustration kind="team" />
              <p className="mt-2 font-semibold">No employees yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Ask your colleagues to sign up, then use <strong>Add member</strong> to find them by name or username.
              </p>
              <div className="mt-3">
                <AddMember teamId={team.id} canMove={owner} />
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Assigned</TableHead>
                  <TableHead className="text-right">In progress</TableHead>
                  <TableHead className="text-right">Passed</TableHead>
                  <TableHead className="text-right">Overdue</TableHead>
                  <TableHead className="w-44">Completion rate</TableHead>
                  <TableHead className="text-right">On time</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map(({ user, metrics, joinedAt }) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Link href={`${base}/people/${user.id}`} className="flex items-center gap-3 hover:underline">
                        <UserAvatar name={user.name} id={user.id} />
                        <div className="grid leading-tight">
                          <span className="font-medium">{user.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {user.username ? `@${user.username} · ` : ""}
                            {joinedAt && `joined ${formatDate(joinedAt)}`}
                          </span>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{metrics.total}</TableCell>
                    <TableCell className="text-right tabular-nums">{metrics.inProgress}</TableCell>
                    <TableCell className="text-right tabular-nums">{metrics.completed}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {metrics.overdue > 0 ? (
                        <span className="font-medium text-red-600 dark:text-red-400">{metrics.overdue}</span>
                      ) : (
                        0
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={(metrics.completionRate ?? 0) * 100} className="h-2" />
                        <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                          {formatPercent(metrics.completionRate)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatPercent(metrics.onTimeRate)}</TableCell>
                    <TableCell>
                      <MemberActions
                        teamId={team.id}
                        userId={user.id}
                        name={user.name}
                        base={base}
                        openTasks={metrics.pending + metrics.inProgress + metrics.overdue}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {formerMembers.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Former members</CardTitle>
            <CardDescription>
              People who did work in {team.name} before moving or leaving. Their work here still counts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Assigned</TableHead>
                  <TableHead className="text-right">Passed</TableHead>
                  <TableHead className="text-right">Overdue</TableHead>
                  <TableHead className="w-44">Completion rate</TableHead>
                  <TableHead className="text-right">On time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formerMembers.map(({ user, role, metrics }) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {owner || role === "MEMBER" ? (
                        <Link href={`${base}/people/${user.id}`} className="hover:underline">
                          {user.name}
                        </Link>
                      ) : (
                        user.name
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{metrics.total}</TableCell>
                    <TableCell className="text-right tabular-nums">{metrics.completed}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {metrics.overdue > 0 ? (
                        <span className="font-medium text-red-600 dark:text-red-400">{metrics.overdue}</span>
                      ) : (
                        0
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={(metrics.completionRate ?? 0) * 100} className="h-2" />
                        <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                          {formatPercent(metrics.completionRate)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatPercent(metrics.onTimeRate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}

/** The manager's own workload in this team (tasks assigned to them personally). */
function MiniMetrics({ metrics }: { metrics: TaskMetrics }) {
  const open = metrics.pending + metrics.inProgress + metrics.overdue;
  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <ClipboardList className="size-4" />
        {open} own task{open === 1 ? "" : "s"} open
      </span>
      {metrics.overdue > 0 && (
        <span className="flex items-center gap-1.5 font-medium text-red-600 dark:text-red-400">
          <AlertTriangle className="size-4" />
          {metrics.overdue} overdue
        </span>
      )}
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <CheckCircle2 className="size-4 text-emerald-600" />
        {metrics.completed} done
      </span>
    </div>
  );
}
