"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/*
 * Charts follow the dataviz rules: fixed categorical slot order, thin marks,
 * recessive grid, one y-axis, legend for multi-series, hover tooltips, and a
 * table view (the member table on the page) for exact values.
 */

const axisProps = {
  stroke: "var(--chart-axis)",
  tick: { fill: "var(--chart-axis)", fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: "var(--chart-grid)" },
};

function TooltipBox({
  active,
  label,
  payload,
  suffix = "",
}: {
  active?: boolean;
  label?: string | number;
  payload?: { name?: string; value?: number; color?: string; dataKey?: string | number }[];
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      <ul className="space-y-0.5">
        {payload.map((p) => (
          <li key={String(p.dataKey)} className="flex items-center gap-2 text-muted-foreground">
            <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
            <span>{p.name}</span>
            <span className="ml-auto pl-3 font-medium tabular-nums text-foreground">
              {p.value}
              {suffix}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LegendText(value: string) {
  return <span className="text-xs text-muted-foreground">{value}</span>;
}

export function WeeklyTrendChart({
  data,
}: {
  data: { week: string; assigned: number; completed: number }[];
}) {
  return (
    <div className="h-72" role="img" aria-label="Tasks assigned and completed per week">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="week" {...axisProps} />
          <YAxis allowDecimals={false} {...axisProps} axisLine={false} />
          <Tooltip content={<TooltipBox />} cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }} />
          <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8} formatter={LegendText} />
          <Line
            type="linear"
            dataKey="assigned"
            name="Assigned"
            stroke="var(--series-1)"
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, fill: "var(--card)" }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="linear"
            dataKey="completed"
            name="Completed"
            stroke="var(--series-2)"
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, fill: "var(--card)" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const STACK_ORDER = ["completed", "inProgress", "pending", "overdue"];

export function WorkloadChart({
  data,
}: {
  data: { name: string; completed: number; inProgress: number; pending: number; overdue: number }[];
}) {
  const height = Math.max(200, data.length * 40 + 60);
  return (
    <div style={{ height }} role="img" aria-label="Tasks per member by status">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 8 }} barCategoryGap={10}>
          <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
          <XAxis type="number" allowDecimals={false} {...axisProps} />
          <YAxis type="category" dataKey="name" width={110} {...axisProps} axisLine={false} />
          <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            iconSize={8}
            formatter={LegendText}
            itemSorter={(item) => STACK_ORDER.indexOf(String(item.dataKey))}
          />
          {/* 2px surface-coloured stroke = the gap between stacked segments */}
          <Bar dataKey="completed" name="Completed" stackId="s" fill="var(--series-1)" stroke="var(--card)" strokeWidth={2} />
          <Bar dataKey="inProgress" name="In progress" stackId="s" fill="var(--series-2)" stroke="var(--card)" strokeWidth={2} />
          <Bar dataKey="pending" name="Pending" stackId="s" fill="var(--series-3)" stroke="var(--card)" strokeWidth={2} />
          <Bar
            dataKey="overdue"
            name="Overdue"
            stackId="s"
            fill="var(--series-4)"
            stroke="var(--card)"
            strokeWidth={2}
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RateChart({
  data,
  label,
}: {
  data: { name: string; rate: number }[];
  label: string;
}) {
  const height = Math.max(200, data.length * 36 + 40);
  return (
    <div style={{ height }} role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 8 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
          <XAxis type="number" domain={[0, 100]} unit="%" {...axisProps} />
          <YAxis type="category" dataKey="name" width={110} {...axisProps} axisLine={false} />
          <Tooltip content={<TooltipBox suffix="%" />} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
          <Bar dataKey="rate" name={label} fill="var(--series-1)" radius={[0, 4, 4, 0]}>
            <LabelList
              dataKey="rate"
              position="right"
              formatter={(v: unknown) => `${v}%`}
              style={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
