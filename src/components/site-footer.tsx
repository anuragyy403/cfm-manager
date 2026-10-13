import Link from "next/link";
import { ArrowUpRight, Globe, Mail, MapPin, Phone } from "lucide-react";
import { APP_NAME, BrandMark, COMPANY } from "@/components/brand";
import { cn } from "@/lib/utils";

const year = () => new Date().getFullYear();

/** Full company footer for the public (sign-in / sign-up) pages. */
export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-[#081a2e] text-white/75">
      <div className="h-1 bg-gradient-to-r from-brand-orange via-[#f59a5c] to-brand-orange" />
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_0.8fr] lg:px-10">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <BrandMark className="size-10 ring-0" />
            <div className="grid leading-tight">
              <span className="text-base font-semibold text-white">{APP_NAME}</span>
              <span className="text-xs text-white/55">by {COMPANY.name}</span>
            </div>
          </div>
          <p className="max-w-xs text-sm leading-relaxed">
            The team workspace of {COMPANY.name}: plan work, assign it to the right people and deliver it on
            time, together.
          </p>
        </div>

        <FooterColumn title="Visit us">
          <a
            href={COMPANY.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex gap-3 text-sm hover:text-white"
          >
            <MapPin className="mt-0.5 size-4 shrink-0 text-brand-orange" />
            <span className="leading-relaxed">
              {COMPANY.address.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
              <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-orange group-hover:underline">
                Get directions <ArrowUpRight className="size-3" />
              </span>
            </span>
          </a>
        </FooterColumn>

        <FooterColumn title="Contact">
          <ul className="space-y-3 text-sm">
            <li>
              <a href={COMPANY.phoneHref} className="flex items-center gap-3 hover:text-white">
                <Phone className="size-4 shrink-0 text-brand-orange" />
                {COMPANY.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${COMPANY.email}`} className="flex items-center gap-3 break-all hover:text-white">
                <Mail className="size-4 shrink-0 text-brand-orange" />
                {COMPANY.email}
              </a>
            </li>
            <li>
              <a
                href={COMPANY.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 hover:text-white"
              >
                <Globe className="size-4 shrink-0 text-brand-orange" />
                {COMPANY.websiteLabel}
              </a>
            </li>
          </ul>
        </FooterColumn>

        <FooterColumn title="Workspace">
          <ul className="space-y-3 text-sm">
            <li>
              <Link href="/sign-in" className="hover:text-white">
                Sign in
              </Link>
            </li>
            <li>
              <Link href="/sign-up" className="hover:text-white">
                Create an account
              </Link>
            </li>
            <li>
              <a href={COMPANY.website} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                About {COMPANY.name}
              </a>
            </li>
          </ul>
        </FooterColumn>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-5 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <p>
            © {year()} {COMPANY.name}. All rights reserved.
          </p>
          <p>Built for the {COMPANY.name} team · Lucknow, India</p>
        </div>
      </div>
      <div
        className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full border-[40px] border-brand-orange/10"
        aria-hidden
      />
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold tracking-wider text-white uppercase">{title}</h3>
      {children}
    </div>
  );
}

/** Slim footer shown at the bottom of every page inside the app. */
export function AppFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "flex flex-col gap-3 border-t px-4 py-4 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6 lg:px-8",
        className,
      )}
    >
      <p>
        © {year()} {COMPANY.name} · {APP_NAME}
      </p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="hidden lg:inline">Need help? Contact the office:</span>
        <a href={COMPANY.phoneHref} className="inline-flex items-center gap-1.5 hover:text-foreground">
          <Phone className="size-3.5" /> {COMPANY.phone}
        </a>
        <a href={`mailto:${COMPANY.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
          <Mail className="size-3.5" /> {COMPANY.email}
        </a>
        <a
          href={COMPANY.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-foreground"
        >
          <MapPin className="size-3.5" /> Gomti Nagar, Lucknow
        </a>
      </div>
    </footer>
  );
}
