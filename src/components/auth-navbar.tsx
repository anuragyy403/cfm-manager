"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { COMPANY, Wordmark } from "@/components/brand";

const tagline = ["Strategy", "Creatives", "Performance", "Growth"];

/** Where the navbar button points from each public page. */
function accountSwitch(pathname: string) {
  if (pathname.startsWith("/sign-up")) return { label: "Sign in", href: "/sign-in" };
  if (pathname.startsWith("/sign-in")) return { label: "Create account", href: "/sign-up" };
  return { label: "Back to sign in", href: "/sign-in" };
}

/** Top bar of the sign-in / sign-up pages, styled after the clickfieldmedia.com navbar. */
export function AuthNavbar() {
  const action = accountSwitch(usePathname());

  return (
    <header className="relative z-10 border-b border-[#ddd5c8] bg-[#eee9e1]">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 md:h-[72px] lg:px-10">
        <a href={COMPANY.website} target="_blank" rel="noopener noreferrer" aria-label={`${COMPANY.name} website`}>
          <Wordmark className="h-8 md:h-9" />
        </a>

        {/* The words on the office wall, centred in the bar. */}
        <p
          className="pointer-events-none absolute top-1/2 left-1/2 hidden -translate-1/2 items-center gap-2.5 text-[13px] font-medium text-[#0a2541] lg:flex xl:gap-3.5 xl:text-sm xl:tracking-wide"
        >
          <span className="sr-only">{tagline.join(", ")}</span>
          {tagline.map((word, i) => (
            <span key={word} className="flex items-center gap-2.5 xl:gap-3.5" aria-hidden>
              {i > 0 && <span className="size-1.5 rounded-full bg-brand-orange" />}
              {word}
            </span>
          ))}
        </p>

        <nav aria-label="Account" className="flex items-center gap-2 sm:gap-5">
          <a
            href={COMPANY.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-[#0a2541] transition-colors hover:text-brand-orange"
          >
            <MessageCircle className="size-[18px]" />
            <span className="hidden sm:inline">Need help?</span>
            <span className="sr-only sm:hidden">Need help? Chat on WhatsApp</span>
          </a>
          <Link
            href={action.href}
            className="group inline-flex h-10 items-center gap-3 rounded-lg bg-[#0a2541] pr-4 pl-4 text-sm font-semibold text-white shadow-[0_6px_16px_-6px_rgb(10_37_65/0.6)] transition-colors hover:bg-brand-navy-soft md:h-11 md:pl-5"
          >
            {action.label}
            <span
              className="size-1.5 rounded-full bg-brand-orange transition-transform group-hover:scale-150"
              aria-hidden
            />
          </Link>
        </nav>
      </div>
    </header>
  );
}
