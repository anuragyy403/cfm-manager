import Link from "next/link";
import { ArrowUp, ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import { APP_NAME, COMPANY, Wordmark } from "@/components/brand";
import { cn } from "@/lib/utils";

const year = () => new Date().getFullYear();

/** Full company footer for the public (sign-in / sign-up) pages, matching tech.clickfieldmedia.com. */
export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-[#0a2541] pt-16 text-white">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_0.9fr_1.3fr_0.8fr]">
          <div className="space-y-6">
            <a href={COMPANY.website} target="_blank" rel="noopener noreferrer" className="inline-block">
              <Wordmark tone="white" className="h-10" />
            </a>
            <p className="max-w-sm text-base leading-relaxed text-white/60">
              The team workspace of {COMPANY.name}. Plan the work, give it to the right people and deliver it
              on time, together.
            </p>
            <div className="space-y-3">
              <FooterHeading>Our other sites</FooterHeading>
              <ul className="space-y-2.5">
                {COMPANY.sites.map((site) => (
                  <li key={site.href}>
                    <a
                      href={site.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-1.5 text-[15px] text-white"
                    >
                      <span className="bg-gradient-to-r from-white to-white bg-[length:0%_1px] bg-left-bottom bg-no-repeat transition-[background-size] duration-300 group-hover:bg-[length:100%_1px]">
                        {site.label}
                      </span>
                      <ArrowUpRight className="size-3.5 text-white/70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <nav aria-label="Workspace" className="space-y-5">
            <FooterHeading>Workspace</FooterHeading>
            <ul className="space-y-4">
              {workspaceLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={footerLink}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-5">
            <FooterHeading>Contact</FooterHeading>
            <ul className="space-y-4">
              <li>
                <a href={COMPANY.whatsappUrl} target="_blank" rel="noopener noreferrer" className={footerIconLink}>
                  <WhatsAppIcon className="mt-1 size-4 shrink-0" />
                  <span>{COMPANY.phone}</span>
                  <span className="sr-only">on WhatsApp (opens in a new tab)</span>
                </a>
              </li>
              <li>
                <a href={COMPANY.emailComposeUrl} target="_blank" rel="noopener noreferrer" className={footerIconLink}>
                  <Mail className="mt-1 size-4 shrink-0" />
                  <span className="break-all">{COMPANY.email}</span>
                  <span className="sr-only">(opens a pre-filled email draft)</span>
                </a>
              </li>
              <li>
                <a href={COMPANY.mapsUrl} target="_blank" rel="noopener noreferrer" className={footerIconLink}>
                  <MapPin className="mt-1 size-4 shrink-0" />
                  <span>
                    {COMPANY.address.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </span>
                  <span className="sr-only">(map, opens in a new tab)</span>
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-5">
            <FooterHeading>Follow</FooterHeading>
            <ul className="space-y-4">
              {socialLinks.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener noreferrer" className={footerIconLink}>
                    <Icon className="mt-1 size-4 shrink-0" />
                    <span>{label}</span>
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-5 border-t border-white/10 py-7 text-sm text-white/60 md:flex-row md:items-center md:justify-between">
          <p>
            © {year()} {COMPANY.name}. All rights reserved.
          </p>
          <p className="font-mono text-xs text-white/50">Built in Lucknow · Mon–Sat · 10:00–19:00 IST</p>
          <a href="#" className="group inline-flex items-center gap-3 self-start text-white md:self-auto">
            Back to top
            <span className="grid size-8 place-items-center rounded-full border border-white/15 transition-colors group-hover:border-brand-orange group-hover:bg-brand-orange">
              <ArrowUp className="size-3.5" />
            </span>
          </a>
        </div>
      </div>

      {/* Giant fading wordmark, cut off at the bottom like the company websites. */}
      <div
        className="pointer-events-none relative mt-2 h-[0.76em] overflow-hidden text-[clamp(5rem,20vw,22rem)] leading-none select-none"
        aria-hidden
      >
        <span className="absolute top-0 left-1/2 -translate-x-1/2 bg-[linear-gradient(rgb(255_122_56/0.34),rgb(255_122_56/0.06)_90%)] bg-clip-text font-bold tracking-[-0.04em] whitespace-nowrap text-transparent">
          clickfield
        </span>
      </div>
    </footer>
  );
}

const footerLink = "text-[15px] text-white/78 transition-colors hover:text-white";
const footerIconLink =
  "flex items-start gap-3 text-[15px] leading-relaxed text-white/78 transition-colors hover:text-white";

const workspaceLinks = [
  { label: "Sign in", href: "/sign-in" },
  { label: "Create an account", href: "/sign-up" },
  { label: "Forgot password", href: "/forgot-password" },
];

function FooterHeading({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] tracking-[0.12em] text-white/50 uppercase">{children}</p>;
}

type IconProps = { className?: string };

function WhatsAppIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
      <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
    </svg>
  );
}

function ThreadsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.263 11.097c-.03-3.486-1.92-5.586-5.111-5.586-2.13 0-3.922.963-4.863 2.499l2.062 1.438c.535-.843 1.272-1.543 2.628-1.543 1.528 0 2.318.85 2.544 2.431a15 15 0 0 0-2.236-.173c-4.125 0-6.068 1.867-6.068 4.336s1.943 3.99 4.804 3.99c3.139 0 5.013-2.115 5.781-4.735.798.361 1.348 1.204 1.348 2.47 0 3.387-3.907 5.232-7.22 5.232-4.885 0-8.077-3.207-8.077-8.424 0-6.392 4.223-10.487 9.9-10.487 3.808 0 5.69 1.671 6.97 3.914l2.108-1.475C21.44 2.078 18.331 0 13.663 0 6.227 0 1.168 5.277 1.168 12.934c0 7 4.953 11.066 10.856 11.066 4.878 0 9.809-2.846 9.809-7.716 0-2.545-1.46-4.231-3.569-5.187m-6.33 4.855c-1.077 0-2.026-.512-2.026-1.453 0-1.483 1.822-1.934 3.606-1.934.678 0 1.34.045 1.927.173-.422 1.927-1.671 3.215-3.508 3.214Z" />
    </svg>
  );
}

function XIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" />
    </svg>
  );
}

function LinkedInIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function FacebookIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function InstagramIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

const socialLinks = [
  { label: "Threads", href: COMPANY.socials.threads, Icon: ThreadsIcon },
  { label: "X (Twitter)", href: COMPANY.socials.x, Icon: XIcon },
  { label: "LinkedIn", href: COMPANY.socials.linkedin, Icon: LinkedInIcon },
  { label: "Facebook", href: COMPANY.socials.facebook, Icon: FacebookIcon },
  { label: "Instagram", href: COMPANY.socials.instagram, Icon: InstagramIcon },
];

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
