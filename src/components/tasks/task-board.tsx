import Link from "next/link";
import { AlertTriangle, CheckCircle2, Circle, CircleDot, Hourglass } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { type DisplayStatus, displayStatus, PRIORITY_RANK } from "@/lib/tasks/rules";
import { cn } from "@/lib/utils";
import type { TaskListItem } from "@/server/tasks";
import { PriorityBadge } from "./badges";
import { DueChip } from "./due-chip";
import { TaskRelation } from "./task-table";

const COLUMNS: { status: DisplayStatus; label: string; icon: typeof Circle; accent: string; dot: string }[] = [
  { status: "PENDING", label: "Pending", icon: Circle, accent: "border-t-slate-400", dot: "text-slate-500" },
  { status: "IN_PROGRESS", label: "In progress", icon: CircleDot, accent: "border-t-sky-500", dot: "text-sky-600" },
  { status: "OVERDUE", label: "Overdue", icon: AlertTriangle, accent: "border-t-red-500", dot: "text-red-600" },
  { status: "SUBMITTED", label: "In review", icon: Hourglass, accent: "border-t-violet-500", dot: "text-violet-600" },
  { status: "COMPLETED", label: "Completed", icon: CheckCircle2, accent: "border-t-emerald-500", dot: "text-emerald-600" },
];

const COMPLETED_LIMIT = 15;

/** Kanban-style overview of the team's work, one column per status. */
export function TaskBoard({ tasks, base }: { tasks: TaskListItem[]; base: string }) {
  const now = new Date();
  const byStatus = new Map<DisplayStatus, TaskListItem[]>(COLUMNS.map((c) => [c.status, []]));
  for (const t of tasks) byStatus.get(displayStatus(t, now))!.push(t);

  // Most urgent first in open columns; most recent first for completed.
  for (const [status, list] of byStatus) {
    if (status === "COMPLETED") list.sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime());
    // Waiting longest first, so nothing sits in review forgotten.
    else if (status === "SUBMITTED") list.sort((a, b) => a.submittedAt!.getTime() - b.submittedAt!.getTime());
    else list.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime() || PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
      <div className="grid min-w-[1100px] grid-cols-5 gap-4">
        {COLUMNS.map((col) => {
          const list = byStatus.get(col.status)!;
          const shown = col.status === "COMPLETED" ? list.slice(0, COMPLETED_LIMIT) : list;
          const Icon = col.icon;
          return (
            <section
              key={col.status}
              className={cn("flex flex-col rounded-2xl border border-t-4 bg-muted/40", col.accent)}
              aria-label={`${col.label} tasks`}
            >
              <header className="flex items-center gap-2 px-4 py-3">
                <Icon className={cn("size-4", col.dot)} />
                <h2 className="text-sm font-semibold">{col.label}</h2>
                <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-xs font-medium tabular-nums ring-1 ring-border">
                  {list.length}
                </span>
              </header>
              <div className="flex flex-1 flex-col gap-2.5 px-3 pb-3">
                {shown.length === 0 && (
                  <p className="rounded-xl border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                    Nothing here
                  </p>
                )}
                {shown.map((t) => (
                  <Link
                    key={t.id}
                    href={`${base}/tasks/${t.id}`}
                    className="group space-y-3 rounded-xl border bg-card p-3 shadow-xs transition-all hover:-translate-y-0.5 hover:border-brand-navy/20 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-brand-navy dark:group-hover:text-white">
                        {t.title}
                      </p>
                      <PriorityBadge priority={t.priority} className="shrink-0" />
                    </div>
                    {(t.parent || t._count.subtasks > 0) && (
                      <div className="-mt-2">
                        <TaskRelation task={t} />
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <UserAvatar name={t.assignee.name} id={t.assignee.id} size="xs" />
                        <span className="truncate text-xs text-muted-foreground">{t.assignee.name.split(" ")[0]}</span>
                      </span>
                      <DueChip task={t} />
                    </div>
                  </Link>
                ))}
                {list.length > shown.length && (
                  <Link
                    href={`${base}/tasks?view=COMPLETED`}
                    className="py-1 text-center text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    + {list.length - shown.length} more completed
                  </Link>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
