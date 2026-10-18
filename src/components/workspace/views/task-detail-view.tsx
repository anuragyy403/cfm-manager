import Link from "next/link";
import { ArrowLeft, Archive, CornerDownRight, Lock, Users } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { ActivityFeed } from "@/components/tasks/activity-feed";
import { PriorityBadge, StatusBadge } from "@/components/tasks/badges";
import { ReviewCard } from "@/components/tasks/review-card";
import { TaskListItem } from "@/components/tasks/task-list-item";
import { TaskTimeline } from "@/components/tasks/task-timeline";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { UserAvatar } from "@/components/user-avatar";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/roles";
import { changesRequested, reviewerIsOwner } from "@/lib/tasks/rules";
import { canAddSubtask, canManageTask, canReview, isOwner } from "@/server/access";
import type { CurrentUser } from "@/server/session";
import { getTask, namesForActivities } from "@/server/tasks";
import { listAssignableTeams } from "@/server/teams";
import { NewTaskButton } from "../new-task-button";
import { ReviewActions } from "../review-actions";
import { TaskManageActions } from "../task-manage-actions";
import { WorkActions } from "../work-actions";

/**
 * One task as a lead sees it: details, subtasks, history and the actions
 * this lead may take. A manager looking at a task assigned to them also gets
 * the start / complete buttons.
 */
export async function TaskDetailView({ viewer, base, id }: { viewer: CurrentUser; base: string; id: string }) {
  const task = await getTask(viewer, id);
  const [teams, names] = await Promise.all([
    listAssignableTeams(viewer, task.teamId),
    namesForActivities(task.activities),
  ]);

  const manageable = canManageTask(viewer, task);
  const splittable = canAddSubtask(viewer, task);
  const mine = task.assigneeId === viewer.id;
  const reviewable = canReview(viewer, task) && task.status === "SUBMITTED" && !task.archivedAt;
  // The team's manager reviews; the owner reviews a manager's own work.
  const reviewer = reviewerIsOwner(task)
    ? isOwner(viewer)
      ? "you"
      : "the owner"
    : task.team.managerId === viewer.id
      ? "you"
      : task.team.manager.name;
  const assigneeOnTeam =
    task.team.members.some((m) => m.userId === task.assigneeId) ||
    (task.team.managerId === task.assigneeId && task.assignee.role === "MANAGER");
  // Managers can open employee profiles only; the owner can open anyone's.
  const assigneeHref =
    isOwner(viewer) || task.assignee.role === "MEMBER" ? `${base}/people/${task.assignee.id}` : undefined;

  const subtasks = task.subtasks.filter((s) => !s.archivedAt);
  const subtasksDone = subtasks.filter((s) => s.status === "COMPLETED").length;

  return (
    <>
      <AutoRefresh />
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4">
        <Link href={task.parent ? `${base}/tasks/${task.parent.id}` : `${base}/tasks`}>
          <ArrowLeft />
          {task.parent ? "Main task" : "All tasks"}
        </Link>
      </Button>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} dueAt={task.dueAt} reviewNote={task.reviewNote} />
            <PriorityBadge priority={task.priority} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{task.title}</h1>
          {task.parent && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CornerDownRight className="size-4" />
              Subtask of{" "}
              <Link href={`${base}/tasks/${task.parent.id}`} className="font-medium text-foreground hover:underline">
                {task.parent.title}
              </Link>
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {mine && !task.archivedAt && (
            <WorkActions taskId={task.id} status={task.status} reviewer="the owner" resubmit={changesRequested(task)} />
          )}
          {manageable && (
            <TaskManageActions
              archived={!!task.archivedAt}
              teams={teams}
              base={base}
              subtaskCount={subtasks.length}
              task={{
                id: task.id,
                title: task.title,
                description: task.description,
                priority: task.priority,
                dueAt: task.dueAt.toISOString(),
                assigneeId: task.assigneeId,
                teamId: task.teamId,
                completed: task.status === "COMPLETED",
              }}
            />
          )}
        </div>
      </div>

      {!manageable && !mine && (
        <Alert className="mb-6">
          <Lock />
          <AlertTitle>Assigned by the owner</AlertTitle>
          <AlertDescription>
            You can follow this task{splittable ? " and split it into subtasks" : ""}, but only the owner can edit,
            reassign or archive it.
          </AlertDescription>
        </Alert>
      )}
      {task.archivedAt && (
        <Alert className="mb-6">
          <Archive />
          <AlertTitle>Archived {formatDateTime(task.archivedAt)}</AlertTitle>
          <AlertDescription>
            Archived tasks are hidden from the assignee and excluded from analytics. Restore it to make it active
            again.
          </AlertDescription>
        </Alert>
      )}
      {!assigneeOnTeam && !task.archivedAt && task.status !== "COMPLETED" && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>The assignee is no longer on {task.team.name}</AlertTitle>
          <AlertDescription>
            {manageable
              ? "Use “Edit / reassign” to give this task to someone on the team."
              : "Ask the owner to reassign it."}
          </AlertDescription>
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

          <ReviewCard
            task={task}
            activities={task.activities}
            viewer={mine ? "assignee" : "lead"}
            assigneeName={task.assignee.name}
            reviewer={mine ? "the owner" : reviewer}
            actions={reviewable ? <ReviewActions taskId={task.id} assigneeName={task.assignee.name} /> : undefined}
          />

          {!task.parent && (splittable || task.subtasks.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Subtasks</CardTitle>
                <CardDescription>
                  {subtasks.length === 0
                    ? "Split this task into smaller pieces for people on the team."
                    : `${subtasksDone} of ${subtasks.length} done`}
                </CardDescription>
                {splittable && (
                  <CardAction>
                    <NewTaskButton
                      teams={teams}
                      base={base}
                      variant="outline"
                      parent={{ id: task.id, title: task.title, teamId: task.teamId }}
                    />
                  </CardAction>
                )}
              </CardHeader>
              {task.subtasks.length > 0 && (
                <CardContent className="space-y-3">
                  {subtasks.length > 0 && (
                    <Progress
                      value={(subtasksDone / subtasks.length) * 100}
                      className="h-1.5 **:data-[slot=progress-indicator]:bg-emerald-500"
                    />
                  )}
                  <div className="space-y-2">
                    {task.subtasks.map((s) => (
                      <div key={s.id} className={s.archivedAt ? "opacity-50" : undefined}>
                        <TaskListItem task={s} href={`${base}/tasks/${s.id}`} assignee={s.assignee} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
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
              <PersonLink href={assigneeHref}>
                <UserAvatar name={task.assignee.name} id={task.assignee.id} size="md" />
                <div className="grid leading-tight">
                  <span className="font-medium">{mine ? `${task.assignee.name} (you)` : task.assignee.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {ROLE_LABELS[task.assignee.role]} · {task.assignee.email}
                  </span>
                </div>
              </PersonLink>
              <p className="mt-4 text-xs text-muted-foreground">
                Assigned by {task.createdBy.id === viewer.id ? "you" : task.createdBy.name}
                {task.createdBy.role === "ADMIN" && task.createdBy.id !== viewer.id ? " (owner)" : ""}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Team</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href={`${base}/teams/${task.team.id}`} className="flex items-center gap-3 hover:underline">
                <span className="flex size-9 items-center justify-center rounded-lg bg-brand-navy text-white">
                  <Users className="size-4" />
                </span>
                <div className="grid leading-tight">
                  <span className="font-medium">{task.team.name}</span>
                  <span className="text-sm text-muted-foreground">Managed by {task.team.manager.name}</span>
                </div>
              </Link>
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

function PersonLink({ href, children }: { href?: string; children: React.ReactNode }) {
  if (!href) return <div className="flex items-center gap-3">{children}</div>;
  return (
    <Link href={href} className="flex items-center gap-3 hover:underline">
      {children}
    </Link>
  );
}
