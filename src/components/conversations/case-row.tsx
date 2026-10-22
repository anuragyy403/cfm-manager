import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DeletedTag } from "@/components/deleted-tag";
import { UserAvatar } from "@/components/user-avatar";
import { type CaseCategory, type CaseStatus, CATEGORY_LABELS } from "@/lib/conversations";
import { formatRelative } from "@/lib/format";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { CaseStatusBadge, UnreadDot, UrgentTag } from "./case-badges";

export type CaseRowData = {
  id: string;
  subject: string | null;
  category: CaseCategory | null;
  urgency: "NORMAL" | "URGENT" | null;
  status: CaseStatus;
  lastMessageAt: Date;
  unread: boolean;
  creator: {
    id: string;
    name: string;
    image: string | null;
    role: AppRole;
    deletedAt: Date | null;
    memberships: { team: { name: string } }[];
  };
  aboutUser: { name: string; deletedAt: Date | null } | null;
  _count: { messages: number };
};

/** One case in a list. The owner sees who raised it; the raiser sees their own wording. */
export function CaseRow({ row, href, forOwner }: { row: CaseRowData; href: string; forOwner: boolean }) {
  const team = row.creator.memberships[0]?.team.name;
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 rounded-2xl border bg-card px-4 py-3.5 transition hover:-translate-y-px hover:shadow-sm",
          row.unread && "border-brand-orange/40 bg-brand-orange-soft/40",
          row.status === "WITHDRAWN" && "opacity-70",
        )}
      >
        {forOwner && <UserAvatar name={row.creator.name} id={row.creator.id} image={row.creator.image} size="md" />}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {row.unread && <UnreadDot />}
            <p className={cn("truncate", row.unread ? "font-semibold" : "font-medium")}>{row.subject}</p>
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {forOwner && (
              <>
                {row.creator.name}
                {row.creator.deletedAt && <DeletedTag />}
                {" · "}
                {ROLE_LABELS[row.creator.role]}
                {team ? `, ${team}` : ""}
                {" · "}
              </>
            )}
            {row.category && CATEGORY_LABELS[row.category]}
            {row.aboutUser && ` · about ${row.aboutUser.name}`}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <CaseStatusBadge status={row.status} forOwner={forOwner} />
            {row.urgency === "URGENT" && row.status !== "WITHDRAWN" && <UrgentTag />}
            <span>
              {row._count.messages} {row._count.messages === 1 ? "message" : "messages"} · {formatRelative(row.lastMessageAt)}
            </span>
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}

