import { redirect } from "next/navigation";
import { CheckCircle2, CircleDot, Clock, Sparkles } from "lucide-react";
import { APP_NAME, Brand, BrandMark, COMPANY_NAME } from "@/components/brand";
import { SiteFooter } from "@/components/site-footer";
import { getCurrentUser, homePathFor } from "@/server/session";

const highlights = [
  "Assign work to the right person in seconds",
  "See every task's status, deadline and history",
  "Track completion and on-time rates across the team",
];

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user.role));

  return (
    <div className="flex min-h-svh flex-col">
      <div className="grid flex-1 lg:min-h-svh lg:grid-cols-[1.05fr_1fr]">
        {/* Brand panel in Clickfieldmedia navy with the logo's orange as accent. */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-navy p-10 text-white lg:flex xl:p-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgb(230_94_21/0.18),transparent_55%)]" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]"
            aria-hidden
          />

          <div className="relative flex items-center gap-3">
            <BrandMark className="size-11 ring-0" />
            <div className="grid leading-tight">
              <span className="text-lg font-semibold">{APP_NAME}</span>
              <span className="text-xs text-white/60">by {COMPANY_NAME}</span>
            </div>
          </div>

          <div className="relative space-y-10">
            <div className="max-w-md space-y-5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90 ring-1 ring-white/15">
                <Sparkles className="size-3.5 text-brand-orange" /> Your team&apos;s workspace
              </span>
              <h1 className="text-4xl font-semibold leading-[1.15] tracking-tight">
                Plan, assign and track your team&apos;s work{" "}
                <span className="text-brand-orange">in one place.</span>
              </h1>
              <ul className="space-y-3 text-white/80">
                {highlights.map((h) => (
                  <li key={h} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-orange" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
            <PreviewCards />
          </div>

          <p className="relative text-sm text-white/50">Made for the {COMPANY_NAME} team</p>
        </aside>

        <main className="flex flex-col items-center justify-center gap-8 bg-background px-6 py-12 md:px-10">
          <Brand className="lg:hidden" />
          <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-xl shadow-brand-navy/5 sm:p-8">
            {children}
          </div>
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}

/** Decorative glimpse of the app on the brand panel. */
function PreviewCards() {
  return (
    <div className="relative h-44 max-w-md" aria-hidden>
      <div className="absolute top-0 left-0 w-72 -rotate-2 rounded-xl bg-white/[0.07] p-4 ring-1 ring-white/15 backdrop-blur">
        <p className="text-sm font-medium">Develop the Company Landing Page</p>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-emerald-300">
            <CheckCircle2 className="size-3" /> Completed
          </span>
          <span className="text-white/60">On time</span>
        </div>
      </div>
      <div className="absolute top-20 left-16 w-72 rotate-1 rounded-xl bg-white/[0.1] p-4 shadow-2xl ring-1 ring-white/20 backdrop-blur">
        <p className="text-sm font-medium">Prepare Q3 client report</p>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-400/15 px-2 py-0.5 text-sky-300">
            <CircleDot className="size-3" /> In progress
          </span>
          <span className="inline-flex items-center gap-1 text-brand-orange">
            <Clock className="size-3" /> Due in 2 days
          </span>
        </div>
      </div>
      <div className="absolute top-2 left-[19rem] hidden w-28 rounded-xl bg-brand-orange p-3 text-center shadow-xl xl:block">
        <p className="text-2xl font-bold">92%</p>
        <p className="text-[11px] text-white/85">on-time rate</p>
      </div>
    </div>
  );
}
