"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { RoundIcon, SunCard } from "./sun-card";

export type HighlightItem = {
  id: string;
  title: string;
  subtitle: string;
  chips: string[];
  href?: string;
  /** Shown bottom-right, like the attendee avatar on the image. */
  person?: { id: string; name: string; image?: string | null };
};

export type HighlightTab = { key: string; label: string; empty: string; items: HighlightItem[] };

/** Tabbed list of the people and teams worth a look, the first one highlighted. */
export function Highlights({ tabs, subtitle }: { tabs: HighlightTab[]; subtitle: string }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const tab = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <SunCard className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="rounded-full border border-[var(--sun-line)] bg-[var(--sun-raised)] px-3 py-1 text-xs text-muted-foreground">
          {subtitle}
        </span>
        <h2 className="text-[15px] font-semibold tracking-tight">Highlights</h2>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Highlights">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === tab?.key}
            onClick={() => setActive(t.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
              t.key === tab?.key
                ? "border-transparent bg-[#22211d] text-white dark:bg-[#f4f1e8] dark:text-[#1f1e1b]"
                : "border-[var(--sun-line)] text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="flex flex-1 flex-col gap-2.5">
        {tab && tab.items.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--sun-line)] px-4 py-10 text-center text-sm text-muted-foreground">
            <Sparkles className="size-5 text-[var(--sun-yellow)]" />
            {tab.empty}
          </div>
        )}
        {tab?.items.map((item, i) => (
          <Item key={item.id} item={item} featured={i === 0} />
        ))}
      </div>
    </SunCard>
  );
}

function Item({ item, featured }: { item: HighlightItem; featured: boolean }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium">{item.title}</p>
          <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
        </div>
        {item.href && (
          <RoundIcon tone={featured ? "solid" : "sun"} className="size-8">
            <ArrowUpRight />
          </RoundIcon>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {item.chips.map((c) => (
            <span
              key={c}
              className="rounded-full border border-[var(--sun-line)] bg-[var(--sun-raised)]/80 px-2.5 py-0.5 text-[11px] text-muted-foreground"
            >
              {c}
            </span>
          ))}
        </div>
        {item.person && <UserAvatar name={item.person.name} id={item.person.id} image={item.person.image} size="xs" className="ring-2 ring-[var(--sun-raised)]" />}
      </div>
    </>
  );

  const className = cn(
    "group block rounded-2xl border p-3.5 transition-all",
    featured
      ? "border-transparent [background:var(--sun-highlight)]"
      : "border-[var(--sun-line)] bg-[var(--sun-raised)]",
    item.href && "hover:-translate-y-px hover:shadow-md",
  );

  return item.href ? (
    <Link href={item.href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
