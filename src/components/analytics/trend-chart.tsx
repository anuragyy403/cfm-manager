"use client";

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type TrendPoint = { week: string; assigned: number; completed: number };

const axis = {
  stroke: "var(--chart-axis)",
  tick: { fill: "var(--chart-axis)", fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const;

/** Legend keys that mirror the marks (line strokes), shown in the card header. */
export function TrendLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="h-[3px] w-4 rounded-full bg-[var(--sun-yellow)]" aria-hidden />
        Completed
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-[2px] w-4 rounded-full bg-[var(--sun-gray)]" aria-hidden />
        Assigned
      </span>
    </div>
  );
}

function TrendTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string | number;
  payload?: { dataKey?: string | number; value?: number }[];
}) {
  if (!active || !payload?.length) return null;
  const value = (key: string) => payload.find((p) => p.dataKey === key)?.value ?? 0;
  const rows = [
    { key: "completed", name: "Completed", color: "var(--sun-yellow)" },
    { key: "assigned", name: "Assigned", color: "var(--sun-gray)" },
  ];
  return (
    <div className="min-w-36 rounded-2xl border border-[var(--sun-line)] bg-[var(--sun-raised)] px-3.5 py-2.5 text-xs shadow-lg">
      <p className="mb-1.5 text-muted-foreground">Week of {label}</p>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2">
            <span className="h-[3px] w-3 rounded-full" style={{ background: r.color }} aria-hidden />
            <span className="text-sm font-semibold tabular-nums">{value(r.key)}</span>
            <span className="text-muted-foreground">{r.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Tasks completed (yellow, with a soft wash) and assigned (gray) per week. */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-[220px]" role="img" aria-label="Tasks completed and assigned per week">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -22 }}>
          <defs>
            <linearGradient id="sun-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--sun-yellow)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--sun-yellow)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="week" {...axis} dy={8} interval="preserveStartEnd" minTickGap={12} />
          <YAxis {...axis} allowDecimals={false} width={40} />
          <Tooltip
            content={<TrendTooltip />}
            cursor={{ stroke: "var(--chart-axis)", strokeOpacity: 0.5, strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="assigned"
            name="Assigned"
            stroke="var(--sun-gray)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: "var(--sun-surface)", strokeWidth: 2, fill: "var(--sun-gray)" }}
          />
          <Area
            type="monotone"
            dataKey="completed"
            name="Completed"
            stroke="var(--sun-yellow)"
            strokeWidth={2.5}
            fill="url(#sun-area)"
            dot={false}
            activeDot={{ r: 5, stroke: "var(--sun-surface)", strokeWidth: 2, fill: "var(--sun-yellow)" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
