import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const tones = {
  default: "border border-sun-line bg-sun-raised text-muted-foreground",
  blue: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  orange: "bg-sun-soft text-sun-deep",
};

/** Small figure tile: label and icon chip on top, a big light number below. */
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
    <Card className="gap-0 py-0 transition-all hover:-translate-y-0.5">
      <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs text-muted-foreground sm:text-sm">{label}</p>
          {Icon && (
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
              <Icon className="size-4" />
            </span>
          )}
        </div>
        <p className="text-[1.75rem] leading-none font-light tracking-tight sm:text-[2.1rem]">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
