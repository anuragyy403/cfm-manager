import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { UserAvatar } from "@/components/user-avatar";
import { formatPercent } from "@/lib/format";
import { computeMetrics } from "@/lib/tasks/metrics";
import { cn } from "@/lib/utils";
import type { listTeamsWithMetrics } from "@/server/teams";

export type GlanceTeam = Awaited<ReturnType<typeof listTeamsWithMetrics>>[number];

/** One team on an overview: who runs it, how it's doing, and what's open. */
export function TeamGlanceCard({ team: t, viewerId, base }: { team: GlanceTeam; viewerId: string; base: string }) {
  const tm = t.metrics;
  const open = tm.pending + tm.inProgress + tm.overdue;
  const figures = [
    { label: "Open", value: open, tone: "text-foreground" },
    { label: "In review", value: tm.inReview, tone: tm.inReview ? "text-violet-600 dark:text-violet-400" : "text-foreground" },
    { label: "Overdue", value: tm.overdue, tone: tm.overdue ? "text-red-600 dark:text-red-400" : "text-foreground" },
    { label: "Done", value: formatPercent(tm.completionRate), tone: "text-foreground" },
  ];
  return (
    <Link
      href={`${base}/teams/${t.id}`}
      className={cn(
        "group flex h-full flex-col gap-4 rounded-2xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md",
        tm.overdue > 0 && "border-red-200 dark:border-red-900",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-navy text-white">
          <Users className="size-5" />
        </span>
        <div className="grid min-w-0 flex-1 gap-0.5 leading-tight">
          <span className="truncate font-semibold">{t.name}</span>
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <UserAvatar name={t.manager.name} id={t.manager.id} size="xs" />
            <span className="truncate">{t.manager.id === viewerId ? "Managed by you" : t.manager.name}</span>
            <span aria-hidden>·</span>
            <span className="shrink-0">
              {t._count.members} {t._count.members === 1 ? "employee" : "employees"}
            </span>
          </span>
        </div>
        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>

      <dl className="grid grid-cols-4 gap-2 rounded-xl bg-muted/50 p-2.5 text-center">
        {figures.map((f) => (
          <div key={f.label} className="grid gap-0.5">
            <dt className="text-[11px] text-muted-foreground">{f.label}</dt>
            <dd className={cn("text-lg font-semibold tabular-nums", f.tone)}>{f.value}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-1.5">
        <Progress
          value={(tm.completionRate ?? 0) * 100}
          className="h-1.5 **:data-[slot=progress-indicator]:bg-brand-orange"
        />
        <p className="text-xs text-muted-foreground tabular-nums">
          {tm.completed} of {tm.total} tasks passed
        </p>
      </div>
    </Link>
  );
}

/** Adds up team metrics into one company-wide set (rates recomputed from the totals). */
export function sumMetrics(list: ReturnType<typeof computeMetrics>[]) {
  const total = computeMetrics([]);
  let completionMs = 0;
  for (const x of list) {
    total.total += x.total;
    total.completed += x.completed;
    total.inReview += x.inReview;
    total.inProgress += x.inProgress;
    total.pending += x.pending;
    total.overdue += x.overdue;
    total.completedOnTime += x.completedOnTime;
    total.completedLate += x.completedLate;
    total.passedFirstTime += x.passedFirstTime;
    completionMs += (x.avgCompletionMs ?? 0) * x.completed;
  }
  total.completionRate = total.total ? total.completed / total.total : null;
  total.onTimeRate = total.completed ? total.completedOnTime / total.completed : null;
  total.firstTimePassRate = total.completed ? total.passedFirstTime / total.completed : null;
  total.avgCompletionMs = total.completed ? completionMs / total.completed : null;
  return total;
}
