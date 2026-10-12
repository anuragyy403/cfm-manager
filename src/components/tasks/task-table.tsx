import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatDateTime, formatRelative, initials } from "@/lib/format";
import { completedOnTime, isDueSoon, isOverdue } from "@/lib/tasks/rules";
import { cn } from "@/lib/utils";
import type { TaskListItem } from "@/server/tasks";
import { PriorityBadge, StatusBadge } from "./badges";

/** Admin task table: every task with who owns it, its status and its dates. */
export function TaskTable({
  tasks,
  showAssignee = true,
}: {
  tasks: TaskListItem[];
  showAssignee?: boolean;
}) {
  const now = new Date();
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
          const overdue = isOverdue(t, now);
          const dueSoon = isDueSoon(t, now);
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
                    <Avatar className="size-6">
                      <AvatarFallback className="text-[10px]">{initials(t.assignee.name)}</AvatarFallback>
                    </Avatar>
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
                <div className="grid leading-tight" title={formatDateTime(t.dueAt)}>
                  <span className="text-sm">{formatDateTime(t.dueAt)}</span>
                  {t.status !== "COMPLETED" && (
                    <span
                      className={cn(
                        "text-xs",
                        overdue
                          ? "font-medium text-red-600 dark:text-red-400"
                          : dueSoon
                            ? "font-medium text-amber-600 dark:text-amber-400"
                            : "text-muted-foreground",
                      )}
                    >
                      {overdue ? `Overdue ${formatRelative(t.dueAt).replace(" ago", "")}` : `Due ${formatRelative(t.dueAt)}`}
                    </span>
                  )}
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
