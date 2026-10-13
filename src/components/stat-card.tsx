import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const tones = {
  default: "bg-brand-navy/[0.07] text-brand-navy dark:bg-white/10 dark:text-white",
  blue: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  orange: "bg-brand-orange-soft text-brand-orange-hover",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: keyof typeof tones;
}) {
  return (
    <Card className="gap-0 py-0 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="flex items-start justify-between gap-2 p-4 sm:gap-3 sm:p-5">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div className={cn("hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex", tones[tone])}>
            <Icon className="size-5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
