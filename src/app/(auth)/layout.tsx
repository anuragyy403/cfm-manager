import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Brand } from "@/components/brand";
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
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary-foreground text-xs font-bold text-primary">
            CFM
          </div>
          <span className="text-base font-semibold">CFM Manager</span>
        </div>
        <div className="max-w-md space-y-6">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Plan, assign and track your team&apos;s work in one place.
          </h1>
          <ul className="space-y-3 text-primary-foreground/85">
            {highlights.map((h) => (
              <li key={h} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-primary-foreground/70">
          © {new Date().getFullYear()} CFM Manager
        </p>
        <div className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-primary-foreground/10" />
      </aside>
      <main className="flex flex-col items-center justify-center gap-8 p-6 md:p-10">
        <Brand className="lg:hidden" />
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
