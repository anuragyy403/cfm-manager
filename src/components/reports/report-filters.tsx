"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const fieldClass = "h-10 w-full rounded-lg border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";

export function ReportFilters({ base, teams, people, filters, personal }: {
  base: string;
  teams: { id: string; name: string }[];
  people: { id: string; name: string; deletedAt: string | null; teamIds: string[] }[];
  filters: { teamId: string; personId: string; from: string; to: string };
  personal: boolean;
}) {
  const [team, setTeam] = useState(filters.teamId);
  const [person, setPerson] = useState(filters.personId);
  const [from, setFrom] = useState(filters.from);
  return <form method="get" action={`${base}/work-reports`} className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
    <label className="space-y-1.5 text-sm font-medium">Team<select name="team" value={team} onChange={(e) => { setTeam(e.target.value); setPerson(""); }} className={fieldClass}><option value="">All permitted teams</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    <label className="space-y-1.5 text-sm font-medium">Employee<select name="person" value={person} onChange={(e) => setPerson(e.target.value)} className={fieldClass}><option value="">{personal ? "My work" : "All permitted employees"}</option>{people.filter((p) => !team || p.teamIds.includes(team)).map((p) => <option key={p.id} value={p.id}>{p.name}{p.deletedAt ? " (Deleted)" : ""}</option>)}</select></label>
    <label className="space-y-1.5 text-sm font-medium">Assigned from<input type="date" name="from" value={from} onChange={(e) => setFrom(e.target.value)} className={fieldClass} /></label>
    <label className="space-y-1.5 text-sm font-medium">Assigned through<input type="date" name="to" defaultValue={filters.to} min={from || undefined} className={fieldClass} /></label>
    <div className="flex flex-wrap items-center gap-2 sm:col-span-2 xl:col-span-4"><Button type="submit" variant="brand">Generate report</Button><Button asChild variant="ghost"><Link href={`${base}/work-reports`}>Reset</Link></Button></div>
  </form>;
}
