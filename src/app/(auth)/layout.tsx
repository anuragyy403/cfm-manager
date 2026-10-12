import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { APP_NAME, Brand, BrandMark, COMPANY_NAME } from "@/components/brand";
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
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Brand panel in Clickfieldmedia navy with the logo's orange as accent. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#0c243e] p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <BrandMark className="size-10 ring-0" />
          <div className="grid leading-tight">
            <span className="text-base font-semibold">{APP_NAME}</span>
            <span className="text-xs text-white/60">by {COMPANY_NAME}</span>
          </div>
        </div>
        <div className="relative z-10 max-w-md space-y-6">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Plan, assign and track your team&apos;s work in one place.
          </h1>
          <ul className="space-y-3 text-white/85">
            {highlights.map((h) => (
              <li key={h} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#e65e15]" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/60">
          © {new Date().getFullYear()} {COMPANY_NAME}
        </p>
        <div className="pointer-events-none absolute -right-28 -bottom-28 size-96 rounded-full border-[48px] border-[#e65e15]/15" />
      </aside>
      <main className="flex flex-col items-center justify-center gap-8 p-6 md:p-10">
        <Brand className="lg:hidden" />
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
