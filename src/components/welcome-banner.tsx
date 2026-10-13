import { APP_TIMEZONE } from "@/lib/format";
import { cn } from "@/lib/utils";

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: APP_TIMEZONE }).format(new Date()),
  );
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function today() {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: APP_TIMEZONE,
  }).format(new Date());
}

/** Navy hero banner with a time-of-day greeting, used at the top of both dashboards. */
export function WelcomeBanner({
  name,
  subtitle,
  actions,
  aside,
  className,
}: {
  name: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Right-hand visual, e.g. a progress ring. */
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative mb-6 overflow-hidden rounded-2xl bg-brand-navy px-6 py-7 text-white shadow-lg shadow-brand-navy/10 sm:px-8",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgb(230_94_21/0.28),transparent_55%)]" />
      <div
        className="pointer-events-none absolute -right-16 -bottom-20 size-64 rounded-full border-[36px] border-white/[0.04]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:20px_20px]"
        aria-hidden
      />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-medium tracking-wider text-white/60 uppercase">{today()}</p>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-4xl">
            {greeting()}, <span className="text-brand-orange">{name.split(" ")[0]}</span>
          </h1>
          {subtitle && <p className="max-w-xl text-sm text-white/75">{subtitle}</p>}
          {actions && <div className="flex flex-wrap gap-2 pt-2">{actions}</div>}
        </div>
        {aside && <div className="hidden shrink-0 sm:block">{aside}</div>}
      </div>
    </section>
  );
}
