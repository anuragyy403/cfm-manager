import { AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type StatusSlice = {
  key: string;
  label: string;
  count: number;
  /** CSS colour of the column. */
  color: string;
  /** Ink for the % bubble sitting on the column ("invert": light in light mode, dark in dark mode). */
  onColor: "dark" | "light" | "invert";
  warning?: boolean;
};

/**
 * Where the work stands: one rounded column per status, height relative to
 * the biggest share, a % bubble on top and the label underneath. Every
 * column is labelled, so colour is never the only cue.
 */
export function StatusColumns({ slices }: { slices: StatusSlice[] }) {
  const total = slices.reduce((n, s) => n + s.count, 0);
  const max = Math.max(1, ...slices.map((s) => s.count));

  return (
    <div>
      <div className="flex h-[196px] items-end gap-2" role="list" aria-label="Tasks by status">
        {slices.map((s) => {
          const share = total ? s.count / total : 0;
          const height = s.count === 0 ? 0 : Math.max(10, (s.count / max) * 100);
          return (
            <Tooltip key={s.key}>
              <TooltipTrigger asChild>
                <div
                  role="listitem"
                  tabIndex={0}
                  aria-label={`${s.label}: ${s.count} (${Math.round(share * 100)}%)`}
                  className="group flex h-full min-w-0 flex-1 flex-col justify-end outline-none"
                >
                  {s.count === 0 ? (
                    <div className="h-1.5 rounded-full bg-[var(--sun-track)]" />
                  ) : (
                    <div
                      className="relative flex justify-center rounded-t-[1.1rem] rounded-b-md pt-2 transition-[filter,transform] duration-200 group-hover:brightness-105 group-focus-visible:ring-2 group-focus-visible:ring-ring"
                      style={{ height: `${height}%`, background: s.color }}
                    >
                      <span
                        className={cn(
                          "flex size-9 items-center justify-center rounded-full text-[11px] font-semibold backdrop-blur-sm",
                          s.onColor === "dark" && "bg-white/45 text-[#1f1e1b]",
                          s.onColor === "light" && "bg-white/20 text-white",
                          s.onColor === "invert" && "bg-white/15 text-white dark:bg-black/10 dark:text-[#1f1e1b]",
                          height < 26 && "absolute -top-11 bg-[var(--sun-raised)] text-foreground shadow-sm",
                        )}
                      >
                        {Math.round(share * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <span className="font-semibold tabular-nums">{s.count}</span> {s.label.toLowerCase()} ·{" "}
                {Math.round(share * 100)}%
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <ul className="mt-3 flex gap-2">
        {slices.map((s) => (
          <li key={s.key} className="min-w-0 flex-1 text-center">
            <span className="flex min-h-7 items-start justify-center gap-1 text-[11px] leading-tight text-muted-foreground">
              {s.warning && <AlertTriangle className="size-3 shrink-0 text-[var(--sun-red)]" aria-hidden />}
              {s.label}
            </span>
            <span className="text-sm font-semibold tabular-nums">{s.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
