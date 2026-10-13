import { cn } from "@/lib/utils";

/** Circular progress (0–1) with the value in the middle. */
export function ProgressRing({
  value,
  size = 96,
  stroke = 9,
  label,
  className,
  trackClassName = "stroke-white/15",
  barClassName = "stroke-brand-orange",
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  label?: React.ReactNode;
  className?: string;
  trackClassName?: string;
  barClassName?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value ?? 0));
  return (
    <div className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={trackClassName} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={cn("transition-[stroke-dashoffset] duration-700", barClassName)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xl font-bold tabular-nums">{value === null ? "—" : `${Math.round(pct * 100)}%`}</span>
        {label && <span className="text-[10px] leading-tight opacity-75">{label}</span>}
      </div>
    </div>
  );
}
