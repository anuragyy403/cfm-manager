"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { SunCard } from "./sun-card";

export type PersonRow = {
  key: string;
  id: string;
  name: string;
  username: string | null;
  isManager: boolean;
  isYou: boolean;
  team: string;
  href?: string;
  total: number;
  completed: number;
  inReview: number;
  inProgress: number;
  pending: number;
  overdue: number;
  completionRate: number | null;
  onTimeRate: number | null;
  /** Passed without being sent back, of everything passed. */
  firstTimePassRate: number | null;
  avgTime: string;
};

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

const SEGMENTS = [
  { key: "completed", label: "Passed", color: "var(--sun-yellow)" },
  { key: "inReview", label: "In review", color: "#8b5cf6" },
  { key: "inProgress", label: "In progress", color: "var(--sun-charcoal)" },
  { key: "pending", label: "Not started", color: "var(--sun-gray)" },
  { key: "overdue", label: "Overdue", color: "var(--sun-red)" },
] as const;

/** Everyone who gets work in scope, with a workload bar and their rates. */
export function PeopleTable({ rows, showTeam }: { rows: PersonRow[]; showTeam: boolean }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        r.username?.toLowerCase().includes(term) ||
        r.team.toLowerCase().includes(term),
    );
  }, [q, rows]);
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));

  return (
    // overflow-hidden: with the card's backdrop blur, the wide table would otherwise widen the page.
    <SunCard className="overflow-hidden p-0">
      <div className="flex flex-col gap-3 p-5 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">People performance</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Everyone who gets work here. Workload bars share one scale, so longer means more tasks.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ul className="hidden items-center gap-3 lg:flex" aria-label="Workload legend">
            {SEGMENTS.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="size-2 rounded-[3px]" style={{ background: s.color }} aria-hidden />
                {s.label}
              </li>
            ))}
          </ul>
          <label className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              aria-label="Search people"
              className="h-8 w-full rounded-full border border-[var(--sun-line)] bg-[var(--sun-raised)] pr-3 pl-8 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-44"
            />
          </label>
        </div>
      </div>

      <div className="overflow-x-auto px-3 pb-3">
        <table className="w-full min-w-[940px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              <Th className="rounded-l-xl pl-4">Name</Th>
              {showTeam && <Th>Team</Th>}
              <Th>Role</Th>
              <Th className="w-[26%]">Workload</Th>
              <Th className="text-right">Passed</Th>
              <Th className="text-right">Overdue</Th>
              <Th className="text-right">Completion</Th>
              <Th className="text-right">On time</Th>
              <Th className="text-right">First time</Th>
              <Th className="text-right">Avg. time</Th>
              <Th>Status</Th>
              <Th className="rounded-r-xl pr-4 text-right">
                <span className="sr-only">Open</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                  {rows.length === 0 ? "No one gets work here yet." : `No one matches “${q.trim()}”.`}
                </td>
              </tr>
            )}
            {shown.map((r) => {
              const attention = r.overdue > 0 || (r.onTimeRate !== null && r.onTimeRate < 0.5);
              return (
                <tr key={r.key} className="group">
                  <Td className="pl-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={r.name} id={r.id} />
                      <div className="grid min-w-0 leading-tight">
                        <span className="truncate font-medium">
                          {r.name}
                          {r.isYou && <span className="font-normal text-muted-foreground"> (you)</span>}
                        </span>
                        {r.username && <span className="truncate text-xs text-muted-foreground">@{r.username}</span>}
                      </div>
                    </div>
                  </Td>
                  {showTeam && <Td className="whitespace-nowrap text-muted-foreground">{r.team}</Td>}
                  <Td>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                        r.isManager
                          ? "bg-[#22211d] text-white dark:bg-[#f4f1e8] dark:text-[#1f1e1b]"
                          : "bg-[var(--muted)] text-muted-foreground",
                      )}
                    >
                      {r.isManager ? "Manager" : "Employee"}
                    </span>
                  </Td>
                  <Td>
                    <Workload row={r} max={maxTotal} />
                  </Td>
                  <Td className="text-right tabular-nums">{r.completed}</Td>
                  <Td className={cn("text-right tabular-nums", r.overdue > 0 && "font-semibold text-[var(--sun-red)]")}>
                    {r.overdue}
                  </Td>
                  <Td className="text-right tabular-nums">{pct(r.completionRate)}</Td>
                  <Td className="text-right tabular-nums">{pct(r.onTimeRate)}</Td>
                  <Td className="text-right tabular-nums">{pct(r.firstTimePassRate)}</Td>
                  <Td className="text-right whitespace-nowrap tabular-nums text-muted-foreground">{r.avgTime}</Td>
                  <Td>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs">
                      <span
                        className={cn("size-1.5 rounded-full", attention ? "bg-[var(--sun-red)]" : "bg-emerald-500")}
                        aria-hidden
                      />
                      {attention ? "Needs attention" : r.total === 0 ? "No tasks yet" : "On track"}
                    </span>
                  </Td>
                  <Td className="pr-4 text-right">
                    {r.href ? (
                      <Link
                        href={r.href}
                        aria-label={`Open ${r.name}`}
                        className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[var(--sun-yellow)] hover:text-[#1f1e1b]"
                      >
                        <ArrowUpRight className="size-4" />
                      </Link>
                    ) : null}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SunCard>
  );
}

function Th({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <th className={cn("bg-[var(--muted)]/70 px-3 py-2.5 font-medium whitespace-nowrap", className)}>{children}</th>;
}

function Td({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <td className={cn("border-b border-[var(--sun-line)] px-3 py-3 group-last:border-b-0", className)}>{children}</td>
  );
}

/** Stacked bar of a person's tasks by status (2px gaps between segments). */
function Workload({ row, max }: { row: PersonRow; max: number }) {
  if (row.total === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const label = SEGMENTS.map((s) => `${row[s.key]} ${s.label.toLowerCase()}`).join(", ");
  return (
    <div className="flex w-full items-center gap-2" title={label} aria-label={`${row.total} tasks: ${label}`}>
      <div className="flex h-2.5 gap-[2px]" style={{ width: `calc((100% - 2rem) * ${row.total / max})`, minWidth: 8 }}>
        {SEGMENTS.map((s) =>
          row[s.key] > 0 ? (
            <span
              key={s.key}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ flexGrow: row[s.key], background: s.color }}
            />
          ) : null,
        )}
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{row.total}</span>
    </div>
  );
}
