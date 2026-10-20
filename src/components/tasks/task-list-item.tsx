import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import type { TaskPriority, TaskStatus } from "@/lib/tasks/rules";
import { cn } from "@/lib/utils";
import { PriorityBadge, StatusBadge } from "./badges";
import { DueChip } from "./due-chip";
import { DeletedTag } from "@/components/deleted-tag";

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
  context,
}: {
  task: {
    id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueAt: Date;
    submittedAt?: Date | null;
    completedAt: Date | null;
    reviewNote?: string | null;
  };
  href: string;
  /** Shown on lead views so the owner or manager sees who owns the task. */
  assignee?: { id: string; name: string; deletedAt?: Date | null };
  /** Extra detail such as the team, or "Part of …" for a subtask. */
  context?: string;
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
          {assignee && (
            <span className="mr-1 text-xs text-muted-foreground">
              {assignee.name}
              {assignee.deletedAt && <DeletedTag />}
            </span>
          )}
          {context && <span className="mr-1 max-w-56 truncate text-xs text-muted-foreground">{context}</span>}
          <DueChip task={task} />
          <PriorityBadge priority={task.priority} className="h-6" />
          <StatusBadge status={task.status} dueAt={task.dueAt} reviewNote={task.reviewNote} className="h-6 sm:hidden" />
        </div>
      </div>
      <StatusBadge status={task.status} dueAt={task.dueAt} reviewNote={task.reviewNote} className="hidden h-6 sm:inline-flex" />
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
