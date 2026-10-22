import { CircleCheck, CircleDot, Flame, MessagesSquare, Undo2 } from "lucide-react";
import { type CaseStatus, STATUS_LABELS } from "@/lib/conversations";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<CaseStatus, { icon: typeof CircleDot; className: string }> = {
  OPEN: { icon: CircleDot, className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  IN_DISCUSSION: { icon: MessagesSquare, className: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200" },
  RESOLVED: { icon: CircleCheck, className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
  WITHDRAWN: { icon: Undo2, className: "bg-muted text-muted-foreground" },
};

/** Where a case stands. The owner sees "New" instead of "Waiting for the owner". */
export function CaseStatusBadge({ status, forOwner = false }: { status: CaseStatus; forOwner?: boolean }) {
  const { icon: Icon, className } = STATUS_STYLE[status];
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap", className)}>
      <Icon className="size-3.5" />
      {forOwner && status === "OPEN" ? "New" : STATUS_LABELS[status]}
    </span>
  );
}

export function UrgentTag() {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full bg-red-100 px-2 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
      <Flame className="size-3.5" />
      Urgent
    </span>
  );
}

/** The small orange dot for something unread. */
export function UnreadDot({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-block size-2.5 shrink-0 rounded-full bg-brand-orange shadow-[0_0_0_3px_rgb(230_94_21/0.18)]", className)}
      aria-label="Unread"
    />
  );
}
