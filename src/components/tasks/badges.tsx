import { AlertTriangle, CheckCircle2, Circle, CircleDot, Hourglass, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  changesRequested,
  type DisplayStatus,
  displayStatus,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks/rules";

const statusStyles: Record<DisplayStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  SUBMITTED: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  OVERDUE: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

const statusIcons = {
  PENDING: Circle,
  IN_PROGRESS: CircleDot,
  SUBMITTED: Hourglass,
  COMPLETED: CheckCircle2,
  OVERDUE: AlertTriangle,
};

const changesStyle = "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";

/**
 * The task's status as people see it: overdue is derived from the deadline,
 * and open work the reviewer sent back shows as "Changes requested".
 */
export function StatusBadge({
  status,
  dueAt,
  reviewNote,
  className,
}: {
  status: TaskStatus;
  dueAt: Date;
  /** The reviewer's latest feedback; on open work it means changes were requested. */
  reviewNote?: string | null;
  className?: string;
}) {
  const s = displayStatus({ status, dueAt });
  const sentBack = changesRequested({ status, reviewNote });
  if (sentBack && s !== "OVERDUE") {
    return (
      <Badge className={cn(changesStyle, className)}>
        <RotateCcw />
        Changes requested
      </Badge>
    );
  }
  const Icon = statusIcons[s];
  return (
    <Badge className={cn(statusStyles[s], className)}>
      <Icon />
      {STATUS_LABELS[s]}
      {s === "OVERDUE" && (sentBack || status === "IN_PROGRESS") && (
        <span className="font-normal opacity-80">· {sentBack ? "changes requested" : "in progress"}</span>
      )}
    </Badge>
  );
}

const priorityStyles: Record<TaskPriority, string> = {
  LOW: "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400",
  MEDIUM: "border-sky-200 text-sky-700 dark:border-sky-900 dark:text-sky-300",
  HIGH: "border-amber-300 text-amber-700 dark:border-amber-900 dark:text-amber-300",
  URGENT: "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
};

export function PriorityBadge({ priority, className }: { priority: TaskPriority; className?: string }) {
  return (
    <Badge variant="outline" className={cn(priorityStyles[priority], className)}>
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}
