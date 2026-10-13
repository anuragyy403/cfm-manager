import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import type { TaskPriority, TaskStatus } from "@/lib/tasks/rules";
import { cn } from "@/lib/utils";
import { PriorityBadge, StatusBadge } from "./badges";
import { DueChip } from "./due-chip";

const priorityBar: Record<TaskPriority, string> = {
  LOW: "bg-slate-300 dark:bg-slate-600",
  MEDIUM: "bg-sky-400",
  HIGH: "bg-amber-400",
  URGENT: "bg-red-500",
};

/** Compact task row used in dashboard cards. */
export function TaskListItem({
  task,
  href,
  assignee,
}: {
  task: {
    id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueAt: Date;
    completedAt: Date | null;
  };
  href: string;
  /** Shown on admin views so the manager sees who owns the task. */
  assignee?: { id: string; name: string };
}) {
  return (
    <Link
      href={href}
      className="group relative flex items-center gap-3 overflow-hidden rounded-xl border bg-card py-3 pr-3 pl-4 transition-all hover:-translate-y-px hover:border-brand-navy/20 hover:shadow-md"
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", priorityBar[task.priority])} aria-hidden />
      {assignee && <UserAvatar name={assignee.name} id={assignee.id} />}
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="truncate font-medium group-hover:text-brand-navy dark:group-hover:text-white">{task.title}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {assignee && <span className="mr-1 text-xs text-muted-foreground">{assignee.name}</span>}
          <DueChip task={task} />
          <PriorityBadge priority={task.priority} className="h-6" />
          <StatusBadge status={task.status} dueAt={task.dueAt} className="h-6 sm:hidden" />
        </div>
      </div>
      <StatusBadge status={task.status} dueAt={task.dueAt} className="hidden h-6 sm:inline-flex" />
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
