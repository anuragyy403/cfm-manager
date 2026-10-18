"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { KanbanSquare, Loader2, Rows3, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PRIORITY_LABELS, TASK_PRIORITIES } from "@/lib/tasks/rules";
import { cn } from "@/lib/utils";

const VIEWS = [
  { value: "all", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "SUBMITTED", label: "In review" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "COMPLETED", label: "Completed" },
  { value: "archived", label: "Archived" },
];

export function TaskFilters({
  members,
  teams = [],
  counts,
  layout,
}: {
  members: { id: string; name: string }[];
  /** Shown as a team filter when there is more than one team. */
  teams?: { id: string; name: string }[];
  counts: Record<string, number>;
  layout: "table" | "board";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "" || v === "all" || v === "any") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  // Debounce the text search.
  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const t = window.setTimeout(() => update({ q: q.trim() || null }), 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const view = params.get("view") ?? "all";
  const hasFilters = !!(params.get("q") || params.get("assignee") || params.get("priority") || params.get("team"));

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {layout === "table" ? (
          <div className="overflow-x-auto overflow-y-hidden">
            <Tabs value={view} onValueChange={(v) => update({ view: v })}>
              <TabsList>
                {VIEWS.map((v) => (
                  <TabsTrigger key={v.value} value={v.value} className="gap-1.5">
                    {v.label}
                    {counts[v.value] !== undefined && (
                      <span className="rounded-full bg-muted-foreground/10 px-1.5 text-xs tabular-nums text-muted-foreground">
                        {counts[v.value]}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            All active tasks by status. Open a card to see details or make changes.
          </p>
        )}
        <div className="inline-flex w-fit shrink-0 rounded-lg border bg-card p-0.5" role="group" aria-label="Layout">
          {(
            [
              { value: "table", label: "Table", icon: Rows3 },
              { value: "board", label: "Board", icon: KanbanSquare },
            ] as const
          ).map((l) => (
            <button
              key={l.value}
              type="button"
              aria-pressed={layout === l.value}
              onClick={() => update({ layout: l.value === "table" ? null : "board", view: null })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                layout === l.value && "bg-brand-navy text-white hover:text-white",
              )}
            >
              <l.icon className="size-4" />
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search task titles…"
            className="pl-8"
            aria-label="Search tasks"
          />
        </div>
        {teams.length > 1 && (
          <Select value={params.get("team") ?? "any"} onValueChange={(v) => update({ team: v })}>
            <SelectTrigger className="sm:w-44" aria-label="Filter by team">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">All teams</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={params.get("assignee") ?? "any"} onValueChange={(v) => update({ assignee: v })}>
          <SelectTrigger className="sm:w-48" aria-label="Filter by person">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Everyone</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={params.get("priority") ?? "any"} onValueChange={(v) => update({ priority: v })}>
          <SelectTrigger className="sm:w-40" aria-label="Filter by priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any priority</SelectItem>
            {TASK_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              update({ q: null, assignee: null, priority: null, team: null });
            }}
          >
            <X />
            Clear filters
          </Button>
        )}
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>
    </div>
  );
}
