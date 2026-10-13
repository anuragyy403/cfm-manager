import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type SetupStep = { label: string; description: string; done: boolean; href: string; cta: string };

/** First-run checklist for a new admin. Hidden once every step is done. */
export function GettingStarted({ steps }: { steps: SetupStep[] }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const next = steps.find((s) => !s.done);

  return (
    <Card className="mb-6 overflow-hidden border-brand-orange/30 bg-gradient-to-br from-brand-orange-soft/70 to-card">
      <CardHeader>
        <CardTitle className="text-lg">Let&apos;s get your workspace ready</CardTitle>
        <CardDescription>
          {done} of {steps.length} steps done. It takes about two minutes.
        </CardDescription>
        <Progress value={(done / steps.length) * 100} className="mt-2 h-1.5 **:data-[slot=progress-indicator]:bg-brand-orange" />
      </CardHeader>
      <CardContent>
        <ol className="grid gap-3 md:grid-cols-3">
          {steps.map((s, i) => {
            const isNext = s === next;
            return (
              <li
                key={s.label}
                className={cn(
                  "flex flex-col gap-3 rounded-xl border bg-card p-4 transition-shadow",
                  isNext && "border-brand-orange/50 shadow-md shadow-brand-orange/10",
                  s.done && "opacity-70",
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      s.done
                        ? "bg-emerald-500 text-white"
                        : isNext
                          ? "bg-brand-orange text-white"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {s.done ? <Check className="size-4" /> : i + 1}
                  </span>
                  <span className={cn("font-medium", s.done && "line-through decoration-muted-foreground/50")}>
                    {s.label}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{s.description}</p>
                {!s.done && (
                  <Link
                    href={s.href}
                    className={cn(
                      "mt-auto inline-flex items-center gap-1 text-sm font-medium",
                      isNext ? "text-brand-orange-hover" : "text-muted-foreground",
                    )}
                  >
                    {s.cta} <ArrowRight className="size-3.5" />
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
