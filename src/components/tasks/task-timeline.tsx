import { CalendarClock, CheckCircle2, CirclePlay, Send, SendHorizontal } from "lucide-react";
import { submittedOnTime } from "@/lib/tasks/rules";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

type TimelineTask = {
  assignedAt: Date;
  startedAt: Date | null;
  submittedAt: Date | null;
  completedAt: Date | null;
  dueAt: Date;
  timesFailed?: number;
};

/**
 * Assigned → started → submitted for review → passed, with the deadline for
 * reference. On-time is judged by when the work was handed in.
 */
export function TaskTimeline({ task }: { task: TimelineTask }) {
  const onTime = submittedOnTime(task);
  const rounds = task.timesFailed ?? 0;
  const steps = [
    { label: "Assigned", at: task.assignedAt, icon: Send },
    { label: "Started", at: task.startedAt, icon: CirclePlay },
    {
      label: "Submitted for review",
      at: task.submittedAt,
      icon: SendHorizontal,
      note: task.submittedAt ? (onTime ? "On time" : "Late") : undefined,
      noteTone: onTime ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
    },
    {
      label: "Passed",
      at: task.completedAt,
      icon: CheckCircle2,
      note: !task.completedAt ? undefined : rounds ? `after ${rounds} ${rounds === 1 ? "redo" : "redos"}` : "First time",
      noteTone: rounds ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400",
    },
  ];

  return (
    <div className="space-y-4">
      <ol className="space-y-4">
        {steps.map((s) => {
          const Icon = s.icon;
          const done = s.at !== null;
          return (
            <li key={s.label} className="flex items-start gap-3">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border",
                  done ? "border-primary/30 bg-primary/10 text-primary" : "border-dashed text-muted-foreground",
                )}
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 text-sm">
                <p className="font-medium">
                  {s.label}
                  {s.note && <span className={cn("ml-2 text-xs font-medium", s.noteTone)}>{s.note}</span>}
                </p>
                <p className="text-muted-foreground">
                  {s.at ? formatDateTime(s.at) : s.label === "Started" ? "Not tracked yet" : "Not yet"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="flex items-center gap-3 rounded-lg bg-muted/60 p-3 text-sm">
        <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
        <span>
          Deadline <span className="font-medium">{formatDateTime(task.dueAt)}</span>{" "}
          <span className="text-muted-foreground">({formatRelative(task.dueAt)})</span>
        </span>
      </div>
    </div>
  );
}
