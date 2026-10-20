"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { SunCard } from "./sun-card";
import { DeletedTag } from "@/components/deleted-tag";

/** One person's overall record, across every team they've worked in. */
export type PersonRow = {
  id: string;
  name: string;
  username: string | null;
  isYou: boolean;
  /** Their account was deleted (the record is kept). */
  deleted?: boolean;
  /** Extra text people can search by, e.g. their current team. */
  search: string;
  href?: string;
  total: number;
  completed: number;
  inReview: number;
  overdue: number;
  completionRate: number | null;
  onTimeRate: number | null;
  avgTime: string;
};

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

/** Everyone who gets work in scope, one row each, with their overall numbers. */
export function PeopleTable({ rows }: { rows: PersonRow[] }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        r.username?.toLowerCase().includes(term) ||
        r.search.toLowerCase().includes(term),
    );
  }, [q, rows]);

  return (
    // overflow-hidden: with the card's backdrop blur, the wide table would otherwise widen the page.
    <SunCard className="overflow-hidden p-0">
      <div className="flex flex-col gap-3 p-5 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">People performance</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Each person&apos;s overall record, including work from teams they were on before.
          </p>
        </div>
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

      <div className="overflow-x-auto px-3 pb-3">
        <table className="w-full min-w-[740px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              <Th className="rounded-l-xl pl-4">Name</Th>
              <Th className="text-right">Tasks</Th>
              <Th className="text-right">Passed</Th>
              <Th className="text-right">In review</Th>
              <Th className="text-right">Overdue</Th>
              <Th className="text-right">Completion</Th>
              <Th className="text-right">On time</Th>
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
                <td colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                  {rows.length === 0 ? "No one gets work here yet." : `No one matches “${q.trim()}”.`}
                </td>
              </tr>
            )}
            {shown.map((r) => {
              const attention = r.overdue > 0 || (r.onTimeRate !== null && r.onTimeRate < 0.5);
              return (
                <tr key={r.id} className="group">
                  <Td className="pl-4 font-medium whitespace-nowrap">
                    {r.href ? (
                      <Link href={r.href} className="hover:underline">
                        {r.name}
                      </Link>
                    ) : (
                      r.name
                    )}
                    {r.isYou && <span className="font-normal text-muted-foreground"> (you)</span>}
                    {r.deleted && <DeletedTag />}
                  </Td>
                  <Td className="text-right tabular-nums">{r.total}</Td>
                  <Td className="text-right tabular-nums">{r.completed}</Td>
                  <Td className={cn("text-right tabular-nums", r.inReview > 0 && "font-semibold text-violet-600 dark:text-violet-400")}>
                    {r.inReview}
                  </Td>
                  <Td className={cn("text-right tabular-nums", r.overdue > 0 && "font-semibold text-[var(--sun-red)]")}>
                    {r.overdue}
                  </Td>
                  <Td className="text-right tabular-nums">{pct(r.completionRate)}</Td>
                  <Td className="text-right tabular-nums">{pct(r.onTimeRate)}</Td>
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
