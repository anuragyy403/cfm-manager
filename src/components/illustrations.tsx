import { cn } from "@/lib/utils";

/**
 * Small brand-coloured illustrations for empty states. Decorative only.
 * Navy = var(--brand-navy), orange = var(--brand-orange).
 */
type Kind = "tasks" | "team" | "done" | "search";

export function EmptyIllustration({ kind, className }: { kind: Kind; className?: string }) {
  return (
    <svg viewBox="0 0 160 120" className={cn("h-28 w-auto", className)} aria-hidden>
      <ellipse cx="80" cy="108" rx="56" ry="6" className="fill-muted" />
      {kind === "tasks" && (
        <>
          <rect x="38" y="18" width="84" height="82" rx="10" className="fill-card stroke-border" strokeWidth="2" />
          <rect x="62" y="10" width="36" height="16" rx="6" style={{ fill: "var(--brand-navy)" }} />
          {[40, 58, 76].map((y, i) => (
            <g key={y}>
              <rect x="50" y={y} width="12" height="12" rx="3" className="stroke-border fill-muted" strokeWidth="2" />
              <rect x="70" y={y + 3} width={i === 1 ? 30 : 40} height="6" rx="3" className="fill-muted" />
            </g>
          ))}
          <circle cx="118" cy="28" r="14" style={{ fill: "var(--brand-orange)" }} />
          <path d="M112 28h12M118 22v12" stroke="white" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {kind === "team" && (
        <>
          <circle cx="56" cy="50" r="16" className="fill-muted" />
          <rect x="34" y="70" width="44" height="26" rx="13" className="fill-muted" />
          <circle cx="104" cy="50" r="16" className="fill-muted" />
          <rect x="82" y="70" width="44" height="26" rx="13" className="fill-muted" />
          <circle cx="80" cy="42" r="18" style={{ fill: "var(--brand-navy)" }} />
          <rect x="55" y="64" width="50" height="32" rx="16" style={{ fill: "var(--brand-navy)" }} />
          <circle cx="112" cy="24" r="12" style={{ fill: "var(--brand-orange)" }} />
          <path d="M107 24h10M112 19v10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      {kind === "done" && (
        <>
          <circle cx="80" cy="56" r="38" className="fill-card stroke-border" strokeWidth="2" />
          <circle cx="80" cy="56" r="28" style={{ fill: "var(--brand-navy)" }} />
          <path
            d="M67 57l9 9 18-20"
            fill="none"
            style={{ stroke: "var(--brand-orange)" }}
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {[
            [36, 24],
            [124, 30],
            [130, 78],
            [30, 84],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="3.5" style={{ fill: "var(--brand-orange)" }} opacity="0.6" />
          ))}
        </>
      )}
      {kind === "search" && (
        <>
          <rect x="30" y="26" width="76" height="60" rx="10" className="fill-card stroke-border" strokeWidth="2" />
          <rect x="42" y="40" width="40" height="6" rx="3" className="fill-muted" />
          <rect x="42" y="54" width="52" height="6" rx="3" className="fill-muted" />
          <circle cx="104" cy="70" r="18" fill="none" style={{ stroke: "var(--brand-navy)" }} strokeWidth="6" />
          <path d="M117 83l14 14" style={{ stroke: "var(--brand-orange)" }} strokeWidth="7" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
