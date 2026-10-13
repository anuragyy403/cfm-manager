import Link from "next/link";
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

/** Admin task table: every task with who owns it, its status and its dates. */
export function TaskTable({
  tasks,
  showAssignee = true,
}: {
  tasks: TaskListItem[];
  showAssignee?: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-56">Task</TableHead>
          {showAssignee && <TableHead>Assignee</TableHead>}
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
                  href={`/admin/tasks/${t.id}`}
                  className="line-clamp-2 font-medium whitespace-normal hover:text-primary hover:underline"
                >
                  {t.title}
                </Link>
              </TableCell>
              {showAssignee && (
                <TableCell>
                  <Link href={`/admin/team/${t.assignee.id}`} className="flex items-center gap-2 hover:underline">
                    <UserAvatar name={t.assignee.name} id={t.assignee.id} size="xs" />
                    <span className="text-sm">{t.assignee.name}</span>
                  </Link>
                </TableCell>
              )}
              <TableCell>
                <StatusBadge status={t.status} dueAt={t.dueAt} />
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
