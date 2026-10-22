import Link from "next/link";
import { ChevronRight, HardDrive, Inbox, NotebookPen } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHeader } from "@/components/page-header";
import { UserAvatar } from "@/components/user-avatar";
import { formatBytes } from "@/lib/attachments";
import { formatCalendarDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  attachmentStorageBytes,
  type CaseFilter,
  countCasesByFilter,
  listCasesForOwner,
  listHrDesks,
} from "@/server/conversations";
import type { CurrentUser } from "@/server/session";
import { UnreadDot } from "../case-badges";
import { CaseRow } from "../case-row";

/** The Hobby plan's included Blob storage; the meter warns well before it. */
const STORAGE_ALLOWANCE = 1024 * 1024 * 1024;

const TABS: { value: CaseFilter | "hr"; label: string }[] = [
  { value: "active", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "hr", label: "HR desk" },
];

/** The owner's inbox: private concerns people raised, and HR's meeting reports. */
export async function InboxView({ owner, tab }: { owner: CurrentUser; tab: CaseFilter | "hr" }) {
  const [counts, desks, stored] = await Promise.all([countCasesByFilter(), listHrDesks(owner), attachmentStorageBytes()]);
  const cases = tab === "hr" ? [] : await listCasesForOwner(owner, tab);
  // Urgent ones first, then unread, then newest activity (already the query's order).
  cases.sort(
    (a, b) =>
      Number(b.urgency === "URGENT" && tab === "active") - Number(a.urgency === "URGENT" && tab === "active") ||
      Number(b.unread) - Number(a.unread),
  );
  const unreadDesks = desks.filter((d) => d.unread).length;
  const tabCount = { ...counts, hr: desks.length };

  return (
    <>
      <AutoRefresh intervalMs={20_000} />
      <PageHeader
        title="Inbox"
        description="Concerns people raised privately with you, and HR's meeting reports. Only you see these."
      />

      <nav className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-muted p-1 sm:w-fit" aria-label="Inbox sections">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={t.value === "active" ? "/admin/inbox" : `/admin/inbox?tab=${t.value}`}
            scroll={false}
            aria-current={tab === t.value ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              tab === t.value && "bg-background text-foreground shadow-sm",
            )}
          >
            {t.label}
            <span className="rounded-full bg-muted-foreground/10 px-1.5 text-xs tabular-nums">{tabCount[t.value]}</span>
            {t.value === "hr" && unreadDesks > 0 && <UnreadDot className="size-2" />}
          </Link>
        ))}
      </nav>

      {tab === "hr" ? (
        desks.length === 0 ? (
          <EmptyState icon={NotebookPen} title="No meeting reports yet">
            When HR sends you a meeting report, it shows up here.
          </EmptyState>
        ) : (
          <ul className="space-y-2.5">
            {desks.map((d) => {
              const last = d.messages[0]?.report;
              return (
                <li key={d.id}>
                  <Link
                    href={`/admin/inbox/${d.id}`}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border bg-card px-4 py-3.5 transition hover:-translate-y-px hover:shadow-sm",
                      d.unread && "border-brand-orange/40 bg-brand-orange-soft/40",
                    )}
                  >
                    <UserAvatar name={d.creator.name} id={d.creator.id} image={d.creator.image} size="md" />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="flex items-center gap-2">
                        {d.unread && <UnreadDot />}
                        <span className={d.unread ? "font-semibold" : "font-medium"}>{d.creator.name}</span>
                        <span className="text-xs text-muted-foreground">HR</span>
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {last ? `Latest: ${last.title} · ${formatCalendarDate(last.meetingDate)}` : "No reports yet, just messages"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {d._count.messages} {d._count.messages === 1 ? "report" : "reports"} · last activity{" "}
                        {formatRelative(d.lastMessageAt)}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )
      ) : cases.length === 0 ? (
        <EmptyState icon={Inbox} title={tab === "active" ? "Nothing open" : "Nothing here"}>
          {tab === "active"
            ? "When someone raises a concern with you, it shows up here and you get a notification."
            : "No cases in this list."}
        </EmptyState>
      ) : (
        <ul className="space-y-2.5">
          {cases.map((c) => (
            <CaseRow key={c.id} row={c} href={`/admin/inbox/${c.id}`} forOwner />
          ))}
        </ul>
      )}

      <StorageMeter bytes={stored} />
    </>
  );
}

function EmptyState({ icon: Icon, title, children }: { icon: typeof Inbox; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border bg-card px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-orange-soft text-sun-deep">
        <Icon className="size-6" />
      </span>
      <p className="mt-2 font-semibold">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

/** How much of the photo / video storage is used, with a warning from 80%. */
function StorageMeter({ bytes }: { bytes: number }) {
  const share = Math.min(1, bytes / STORAGE_ALLOWANCE);
  const warn = share >= 0.8;
  return (
    <section
      className={cn(
        "mt-8 flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center",
        warn && "border-amber-300 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <HardDrive className="size-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm font-medium">
          Photo and video storage: {formatBytes(bytes)} of {formatBytes(STORAGE_ALLOWANCE)} used
        </p>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", warn ? "bg-amber-500" : "bg-emerald-500")}
            style={{ width: `${Math.max(share * 100, bytes ? 1 : 0)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {warn
            ? "Nearly full. Upgrade Vercel Blob storage soon, or uploads will start failing."
            : "Covers attachments on tasks, concerns and reports. The free allowance is about 1 GB."}
        </p>
      </div>
    </section>
  );
}
