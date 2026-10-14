import { cn } from "@/lib/utils";

/** Soft cream card used across the analytics dashboard. */
export function SunCard({ className, children, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "rounded-[1.75rem] border border-[var(--sun-line)] bg-[var(--sun-surface)]/85 p-5 shadow-[var(--sun-shadow)] backdrop-blur-sm",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function SunCardHeader({
  title,
  description,
  action,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Round icon button, as on the image: charcoal ("solid") or yellow ("sun"). */
export function RoundIcon({
  tone = "outline",
  className,
  children,
}: {
  tone?: "solid" | "sun" | "outline";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full transition-transform group-hover:scale-105 [&_svg]:size-4",
        tone === "solid" && "bg-[#22211d] text-white dark:bg-[#f4f1e8] dark:text-[#1f1e1b]",
        tone === "sun" && "bg-[var(--sun-yellow)] text-[#1f1e1b]",
        tone === "outline" && "border border-[var(--sun-line)] bg-[var(--sun-raised)] text-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
