import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Archive, MessageSquareText } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { ActivityFeed } from "@/components/tasks/activity-feed";
import { PriorityBadge, StatusBadge } from "@/components/tasks/badges";
import { TaskTimeline } from "@/components/tasks/task-timeline";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, initials } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/session";
import { getTaskForAdmin } from "@/server/tasks";
import { listTeamMembers } from "@/server/teams";
import { TaskAdminActions } from "./task-admin-actions";

export const metadata: Metadata = { title: "Task" };

export default async function AdminTaskPage({ params }: PageProps<"/admin/tasks/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  const task = await getTaskForAdmin(admin, id);
  const members = await listTeamMembers(task.teamId);

  // Names for everyone referenced in the history (including former members).
  const referencedIds = new Set<string>();
  for (const a of task.activities) {
    const d = (a.details ?? {}) as { fromAssigneeId?: string; toAssigneeId?: string };
    if (d.fromAssigneeId) referencedIds.add(d.fromAssigneeId);
    if (d.toAssigneeId) referencedIds.add(d.toAssigneeId);
  }
  const people = referencedIds.size
    ? await prisma.user.findMany({ where: { id: { in: [...referencedIds] } }, select: { id: true, name: true } })
    : [];
  const names = Object.fromEntries(people.map((p) => [p.id, p.name]));
  const assigneeOnTeam = members.some((m) => m.user.id === task.assigneeId);

  return (
    <>
      <AutoRefresh />
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4">
        <Link href="/admin/tasks">
          <ArrowLeft />
          All tasks
        </Link>
      </Button>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} dueAt={task.dueAt} />
            <PriorityBadge priority={task.priority} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{task.title}</h1>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <TaskAdminActions
            archived={!!task.archivedAt}
            members={members.map((m) => ({ id: m.user.id, name: m.user.name, username: m.user.username }))}
            task={{
              id: task.id,
              title: task.title,
              description: task.description,
              priority: task.priority,
              dueAt: task.dueAt.toISOString(),
              assigneeId: task.assigneeId,
              completed: task.status === "COMPLETED",
            }}
          />
        </div>
      </div>

      {task.archivedAt && (
        <Alert className="mb-6">
          <Archive />
          <AlertTitle>Archived {formatDateTime(task.archivedAt)}</AlertTitle>
          <AlertDescription>
            Archived tasks are hidden from the member and excluded from analytics. Restore it to make it active again.
          </AlertDescription>
        </Alert>
      )}
      {!assigneeOnTeam && !task.archivedAt && task.status !== "COMPLETED" && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>The assignee is no longer on your team</AlertTitle>
          <AlertDescription>Use “Edit / reassign” to give this task to a current member.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              {task.description ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{task.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No description.</p>
              )}
            </CardContent>
          </Card>

          {task.status === "COMPLETED" && (
            <Card className="border-emerald-200 dark:border-emerald-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquareText className="size-4 text-emerald-600" />
                  Completion note
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {task.completionNote || <span className="text-muted-foreground">No note.</span>}
                </p>
                {task.completedAt && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Submitted by {task.assignee.name} on {formatDateTime(task.completedAt)}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed activities={task.activities} names={names} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Assigned to</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href={`/admin/team/${task.assignee.id}`} className="flex items-center gap-3 hover:underline">
                <Avatar className="size-10">
                  <AvatarFallback>{initials(task.assignee.name)}</AvatarFallback>
                </Avatar>
                <div className="grid leading-tight">
                  <span className="font-medium">{task.assignee.name}</span>
                  <span className="text-sm text-muted-foreground">{task.assignee.email}</span>
                </div>
              </Link>
              <p className="mt-4 text-xs text-muted-foreground">Created by {task.createdBy.name}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskTimeline task={task} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
