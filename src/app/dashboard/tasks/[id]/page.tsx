import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CornerDownRight, MessageSquareText } from "lucide-react";
import { ActivityFeed } from "@/components/tasks/activity-feed";
import { PriorityBadge, StatusBadge } from "@/components/tasks/badges";
import { TaskTimeline } from "@/components/tasks/task-timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { requireEmployee } from "@/server/session";
import { getMyTask } from "@/server/tasks";
import { WorkActions } from "@/components/workspace/work-actions";

export const metadata: Metadata = { title: "Task" };

export default async function EmployeeTaskPage({ params }: PageProps<"/dashboard/tasks/[id]">) {
  const employee = await requireEmployee();
  const { id } = await params;
  const task = await getMyTask(employee, id);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4">
        <Link href="/dashboard/tasks">
          <ArrowLeft />
          My tasks
        </Link>
      </Button>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} dueAt={task.dueAt} />
            <PriorityBadge priority={task.priority} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{task.title}</h1>
          <p className="text-sm text-muted-foreground">
            Assigned by {task.createdBy.name} · {formatDateTime(task.assignedAt)}
          </p>
          {task.parent && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CornerDownRight className="size-4" />
              Part of <span className="font-medium text-foreground">{task.parent.title}</span>
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <WorkActions taskId={task.id} status={task.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Description &amp; requirements</CardTitle>
            </CardHeader>
            <CardContent>
              {task.description ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{task.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No description was added.</p>
              )}
            </CardContent>
          </Card>

          {task.status === "COMPLETED" && (
            <Card className="border-emerald-200 dark:border-emerald-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquareText className="size-4 text-emerald-600" />
                  Your completion note
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{task.completionNote}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed activities={task.activities} />
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskTimeline task={task} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
