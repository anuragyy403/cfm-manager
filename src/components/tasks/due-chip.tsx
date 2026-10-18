import { AlarmClock, CalendarDays, CheckCircle2, Clock, Hourglass, TriangleAlert } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";
import { completedOnTime, submittedOnTime, type TaskStatus } from "@/lib/tasks/rules";
import { cn } from "@/lib/utils";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function span(ms: number) {
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / 60_000))} min`;
  if (ms < DAY) return `${Math.round(ms / HOUR)} h`;
  const d = Math.round(ms / DAY);
  return `${d} day${d === 1 ? "" : "s"}`;
}

type ChipTask = { status: TaskStatus; dueAt: Date; completedAt: Date | null; submittedAt?: Date | null };

/** Countdown chip: "Due in 5 h", "2 days late", "Done on time"… coloured by urgency. */
export function DueChip({ task, className }: { task: ChipTask; className?: string }) {
  const { label, tone, Icon } = chipFor(task);
  return (
    <span
      title={`Deadline ${formatDateTime(task.dueAt)}`}
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        tone,
        className,
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}

// Server-rendered per request, so reading the clock here is intended.
function chipFor(task: ChipTask) {
  const diff = task.dueAt.getTime() - Date.now();

  let label: string;
  let tone: string;
  let Icon = CalendarDays;

  if (task.status === "COMPLETED") {
    const onTime = completedOnTime(task);
    label = onTime ? "Done on time" : "Done late";
    tone = onTime
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900"
      : "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-900";
    Icon = CheckCircle2;
  } else if (task.status === "SUBMITTED") {
    const onTime = submittedOnTime({ submittedAt: task.submittedAt ?? null, dueAt: task.dueAt });
    label = onTime ? "Submitted on time" : "Submitted late";
    tone = onTime
      ? "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-900"
      : "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-900";
    Icon = Hourglass;
  } else if (diff < 0) {
    label = `${span(-diff)} late`;
    tone = "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-900";
    Icon = TriangleAlert;
  } else if (diff < DAY) {
    label = `Due in ${span(diff)}`;
    tone = "bg-brand-orange-soft text-brand-orange-hover ring-brand-orange/30";
    Icon = AlarmClock;
  } else if (diff < 2 * DAY) {
    label = "Due tomorrow";
    tone = "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900";
    Icon = Clock;
  } else if (diff < 7 * DAY) {
    label = `Due in ${span(diff)}`;
    tone = "bg-slate-50 text-slate-700 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800";
  } else {
    label = `Due ${formatDate(task.dueAt)}`;
    tone = "bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800";
  }

  return { label, tone, Icon };
}
