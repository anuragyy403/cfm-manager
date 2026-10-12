import Link from "next/link";
import { formatDateTime, formatRelative } from "@/lib/format";
import { isDueSoon, isOverdue, type TaskPriority, type TaskStatus } from "@/lib/tasks/rules";
import { cn } from "@/lib/utils";
import { PriorityBadge, StatusBadge } from "./badges";

/** Compact one-line task row used in dashboard cards. */
export function TaskListItem({
  task,
  href,
  subtitle,
}: {
  task: { id: string; title: string; status: TaskStatus; priority: TaskPriority; dueAt: Date };
  href: string;
  subtitle?: React.ReactNode;
}) {
  const overdue = isOverdue(task);
  const soon = isDueSoon(task);
  return (
    <Link
      href={href}
      className="flex flex-col gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 space-y-1">
        <p className="truncate font-medium">{task.title}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {subtitle && <span>{subtitle}</span>}
          {subtitle && <span aria-hidden>·</span>}
          <span
            title={formatDateTime(task.dueAt)}
            className={cn(
              task.status !== "COMPLETED" && overdue && "font-medium text-red-600 dark:text-red-400",
              task.status !== "COMPLETED" && soon && "font-medium text-amber-600 dark:text-amber-400",
            )}
          >
            {task.status === "COMPLETED"
              ? `Due ${formatDateTime(task.dueAt)}`
              : overdue
                ? `Overdue by ${formatRelative(task.dueAt).replace(" ago", "")}`
                : `Due ${formatRelative(task.dueAt)}`}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <PriorityBadge priority={task.priority} />
        <StatusBadge status={task.status} dueAt={task.dueAt} />
      </div>
    </Link>
  );
}
