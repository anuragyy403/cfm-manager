import { APP_TIMEZONE } from "@/lib/format";
import { cn } from "@/lib/utils";

export function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: APP_TIMEZONE }).format(new Date()),
  );
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function today() {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: APP_TIMEZONE,
  }).format(new Date());
}

/**
 * Warm hero at the top of each dashboard: time-of-day greeting, a one-line
 * summary, actions, and an optional visual on the right (e.g. a gauge).
 */
export function WelcomeBanner({
  name,
  subtitle,
  actions,
  aside,
  children,
  className,
}: {
  name: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Right-hand visual, e.g. a gauge. */
  aside?: React.ReactNode;
  /** Extra content under the greeting, e.g. headline figures. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "@container relative mb-6 overflow-hidden rounded-[1.75rem] border border-sun-line p-6 shadow-[var(--sun-shadow)] [background:var(--sun-hero)] sm:p-8",
        className,
      )}
    >
      <div className="grid items-center gap-6 @3xl:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-[2.6rem] sm:leading-[1.1]">
            {greeting()}, {name.split(" ")[0]}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">It&apos;s {today()}</p>
          {subtitle && <p className="mt-3 max-w-2xl text-sm text-foreground/75">{subtitle}</p>}
          {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}
          {children && (
            <>
              <div className="my-6 h-px max-w-xl bg-gradient-to-r from-sun-line to-transparent" />
              {children}
            </>
          )}
        </div>
        {aside && <div className="mx-auto hidden w-full max-w-[280px] sm:block @3xl:w-[280px]">{aside}</div>}
      </div>
    </section>
  );
}
