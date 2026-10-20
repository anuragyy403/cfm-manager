import Link from "next/link";
import { CornerDownRight, ListTree } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatDateTime } from "@/lib/format";
import { completedOnTime } from "@/lib/tasks/rules";
import { cn } from "@/lib/utils";
import type { TaskListItem } from "@/server/tasks";
import { PriorityBadge, StatusBadge } from "./badges";
import { DueChip } from "./due-chip";
import { DeletedTag } from "@/components/deleted-tag";

/** Lead task table: every task with who owns it, its team, status and dates. */
export function TaskTable({
  tasks,
  base,
  showAssignee = true,
  showTeam = false,
}: {
  tasks: TaskListItem[];
  /** Workspace the links point into, e.g. "/admin" or "/manager". */
  base: string;
  showAssignee?: boolean;
  showTeam?: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-56">Task</TableHead>
          {showAssignee && <TableHead>Assignee</TableHead>}
          {showTeam && <TableHead>Team</TableHead>}
          <TableHead>Status</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Deadline</TableHead>
          <TableHead>Assigned</TableHead>
          <TableHead>Completed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((t) => {
          return (
            <TableRow key={t.id} className={cn(t.archivedAt && "opacity-60")}>
              <TableCell className="max-w-80">
                <Link
                  href={`${base}/tasks/${t.id}`}
                  className="line-clamp-2 font-medium whitespace-normal hover:text-primary hover:underline"
                >
                  {t.title}
                </Link>
                <TaskRelation task={t} />
              </TableCell>
              {showAssignee && (
                <TableCell>
                  <Link href={`${base}/people/${t.assignee.id}`} className="flex items-center gap-2 hover:underline">
                    <UserAvatar name={t.assignee.name} id={t.assignee.id} image={t.assignee.image} size="xs" />
                    <span className="text-sm">
                      {t.assignee.name}
                      {t.assignee.deletedAt && <DeletedTag />}
                    </span>
                  </Link>
                </TableCell>
              )}
              {showTeam && (
                <TableCell>
                  <Link href={`${base}/teams/${t.team.id}`} className="text-sm whitespace-nowrap hover:underline">
                    {t.team.name}
                  </Link>
                </TableCell>
              )}
              <TableCell>
                <StatusBadge status={t.status} dueAt={t.dueAt} reviewNote={t.reviewNote} />
              </TableCell>
              <TableCell>
                <PriorityBadge priority={t.priority} />
              </TableCell>
              <TableCell>
                <div className="flex flex-col items-start gap-1">
                  <span className="text-sm">{formatDateTime(t.dueAt)}</span>
                  {t.status !== "COMPLETED" && <DueChip task={t} />}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground" title={formatDateTime(t.assignedAt)}>
                {formatDate(t.assignedAt)}
              </TableCell>
              <TableCell className="text-sm">
                {t.completedAt ? (
                  <div className="grid leading-tight" title={formatDateTime(t.completedAt)}>
                    <span>{formatDate(t.completedAt)}</span>
                    <span
                      className={cn(
                        "text-xs",
                        completedOnTime(t)
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400",
                      )}
                    >
                      {completedOnTime(t) ? "On time" : "Late"}
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** Small line under a title: "Subtask of …" or "3 subtasks". */
export function TaskRelation({ task }: { task: Pick<TaskListItem, "parent" | "_count"> }) {
  if (task.parent) {
    return (
      <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
        <CornerDownRight className="size-3 shrink-0" />
        <span className="truncate">Subtask of {task.parent.title}</span>
      </span>
    );
  }
  if (task._count.subtasks > 0) {
    return (
      <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
        <ListTree className="size-3 shrink-0" />
        {task._count.subtasks} subtask{task._count.subtasks === 1 ? "" : "s"}
      </span>
    );
  }
  return null;
}
