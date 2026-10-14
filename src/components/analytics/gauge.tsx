/**
 * Open-bottom ring gauge (a 250° arc) for a single rate, with a knob at the
 * current value and 0–100 ticks around it. Pure SVG, rendered on the server.
 */

const START = -125; // degrees, clockwise from 12 o'clock
const SWEEP = 250;
const CX = 130;
const CY = 124;
const R = 88;

function point(angle: number, radius: number) {
  const rad = (angle * Math.PI) / 180;
  return [CX + radius * Math.sin(rad), CY - radius * Math.cos(rad)] as const;
}

function arc(from: number, to: number) {
  const [x0, y0] = point(from, R);
  const [x1, y1] = point(to, R);
  const large = to - from > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export function Gauge({
  value,
  label,
  detail,
}: {
  /** 0–1, or null when there is nothing to measure yet. */
  value: number | null;
  label: string;
  detail?: string;
}) {
  const v = value === null ? 0 : Math.min(1, Math.max(0, value));
  const end = START + SWEEP * v;
  const [kx, ky] = point(end, R);
  const ticks = [0, 20, 40, 60, 80, 100];
  const percent = value === null ? "—" : `${Math.round(v * 100)}%`;

  return (
    <figure className="relative mx-auto w-full max-w-[280px]">
      <svg viewBox="0 0 260 230" className="w-full" role="img" aria-label={`${label}: ${percent}`}>
        {/* Minor ticks every 5%. */}
        {Array.from({ length: 21 }, (_, i) => {
          const a = START + (SWEEP * i) / 20;
          const [x0, y0] = point(a, R + 15);
          const [x1, y1] = point(a, R + (i % 4 === 0 ? 21 : 18));
          return (
            <line
              key={i}
              x1={x0}
              y1={y0}
              x2={x1}
              y2={y1}
              stroke="var(--chart-axis)"
              strokeOpacity={i % 4 === 0 ? 0.7 : 0.35}
              strokeWidth={1}
              strokeLinecap="round"
            />
          );
        })}
        {ticks.map((t) => {
          const [x, y] = point(START + (SWEEP * t) / 100, R + 33);
          return (
            <text
              key={t}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="11"
              fill="var(--chart-axis)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {t === 0 ? "00" : t}
            </text>
          );
        })}
        <path d={arc(START, START + SWEEP)} fill="none" stroke="var(--sun-track)" strokeWidth={16} strokeLinecap="round" />
        {v > 0 && (
          <path d={arc(START, end)} fill="none" stroke="var(--sun-yellow)" strokeWidth={16} strokeLinecap="round" />
        )}
        {value !== null && (
          <circle cx={kx} cy={ky} r={10} fill="var(--sun-raised)" stroke="var(--sun-yellow)" strokeWidth={5} />
        )}
      </svg>
      <figcaption className="absolute inset-x-0 top-[38%] text-center">
        <span className="block text-[2.6rem] leading-none font-light tracking-tight">{percent}</span>
        <span className="mt-2 block text-xs font-medium text-muted-foreground">{label}</span>
        {detail && <span className="mt-0.5 block text-[11px] text-muted-foreground">{detail}</span>}
      </figcaption>
    </figure>
  );
}
