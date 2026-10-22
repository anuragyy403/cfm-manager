import { CheckCheck, CornerDownRight, NotebookPen, Users } from "lucide-react";
import { AttachmentGallery } from "@/components/attachments/attachment-gallery";
import { DeletedTag } from "@/components/deleted-tag";
import { UserAvatar } from "@/components/user-avatar";
import { canStillDelete } from "@/lib/conversations";
import { dayKey, formatCalendarDate, formatDateTime, formatDayDivider, formatTime } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";
import type { ThreadMessage } from "@/server/conversations";
import { DeleteMessageButton, ReplyButton } from "./thread-client";

/**
 * A private conversation, oldest message first: chat bubbles (yours on the
 * right), meeting reports as full cards, day dividers, and "Seen" under your
 * latest message once the other side has opened it.
 */
export function Thread({
  messages,
  viewerId,
  otherReadAt,
  otherName,
  firstMessageId,
  isCase,
  closed,
}: {
  messages: ThreadMessage[];
  viewerId: string;
  /** When the other side last opened the conversation. */
  otherReadAt: Date | null;
  /** "the owner", or the other person's first name. */
  otherName: string;
  firstMessageId?: string;
  isCase: boolean;
  /** Withdrawn: no replies, no deleting. */
  closed?: boolean;
}) {
  const lastMine = [...messages].reverse().find((m) => m.authorId === viewerId && !m.deletedAt);

  return (
    <ol className="space-y-4">
      {messages.map((m, i) => {
        const divider = i === 0 || dayKey(m.createdAt) !== dayKey(messages[i - 1]!.createdAt);
        const mine = m.authorId === viewerId;
        return (
          <li key={m.id} id={`m-${m.id}`} className="scroll-mt-24">
            {divider && (
              <div className="my-5 flex items-center gap-3 text-xs font-medium text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                {formatDayDivider(m.createdAt)}
                <span className="h-px flex-1 bg-border" />
              </div>
            )}
            <Message
              message={m}
              mine={mine}
              closed={closed}
              withdrawsCase={isCase && m.id === firstMessageId}
            />
            {lastMine?.id === m.id && (
              <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                {otherReadAt && otherReadAt >= m.createdAt ? (
                  <>
                    <CheckCheck className="size-3.5 text-sky-600" /> Seen by {otherName}
                  </>
                ) : (
                  "Sent"
                )}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Message({
  message: m,
  mine,
  closed,
  withdrawsCase,
}: {
  message: ThreadMessage;
  mine: boolean;
  closed?: boolean;
  withdrawsCase: boolean;
}) {
  const roleTag = m.author.role === "ADMIN" ? "Owner" : m.author.role === "HR" ? "HR" : ROLE_LABELS[m.author.role];
  const header = (
    <div className={cn("mb-1 flex items-center gap-2 text-xs text-muted-foreground", mine && "flex-row-reverse")}>
      <UserAvatar name={m.author.name} id={m.author.id} image={m.author.image} size="xs" />
      <span className="font-medium text-foreground">{mine ? "You" : m.author.name}</span>
      {!mine && <span>{roleTag}</span>}
      {m.author.deletedAt && <DeletedTag />}
      <span title={formatDateTime(m.createdAt)}>{formatTime(m.createdAt)}</span>
    </div>
  );

  if (m.deletedAt) {
    return (
      <div className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
        {header}
        <p className="rounded-2xl border border-dashed px-3.5 py-2 text-sm text-muted-foreground italic">
          {withdrawsCase ? (mine ? "You withdrew this concern" : "They withdrew this concern") : "This message was deleted"}
        </p>
      </div>
    );
  }

  const replyLabel = m.report ? `meeting report “${m.report.title}”` : `${mine ? "your" : `${m.author.name.split(" ")[0]}'s`} message`;
  const actions = !closed && (
    <div className={cn("mt-1 flex items-center gap-1", mine && "justify-end")}>
      <ReplyButton target={{ id: m.id, label: replyLabel }} />
      {mine && canStillDelete(m.createdAt) && (
        <DeleteMessageButton
          messageId={m.id}
          createdAt={m.createdAt.toISOString()}
          withdrawsCase={withdrawsCase}
        />
      )}
    </div>
  );

  if (m.report) {
    return (
      <div>
        {header}
        <ReportCard report={m.report} attachments={m.attachments} />
        {actions}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
      {header}
      <div
        className={cn(
          "max-w-[min(36rem,92%)] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-xs",
          mine ? "rounded-tr-md bg-sun/25 dark:bg-sun/15" : "rounded-tl-md border bg-card",
        )}
      >
        {m.replyTo && <Quoted replyTo={m.replyTo} />}
        {m.body && <p className="break-words whitespace-pre-wrap">{m.body}</p>}
        <AttachmentGallery attachments={m.attachments} className={m.body ? "mt-2" : undefined} />
      </div>
      {actions}
    </div>
  );
}

function Quoted({ replyTo }: { replyTo: NonNullable<ThreadMessage["replyTo"]> }) {
  const text = replyTo.deletedAt
    ? "Deleted message"
    : replyTo.report
      ? `Meeting report: ${replyTo.report.title}`
      : replyTo.body.replace(/\s+/g, " ").slice(0, 140) || "Photos or videos";
  return (
    <a
      href={`#m-${replyTo.id}`}
      className="mb-2 flex gap-1.5 rounded-lg border-l-4 border-l-sun bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-background"
    >
      <CornerDownRight className="mt-0.5 size-3.5 shrink-0" />
      <span className="min-w-0">
        <span className="font-medium text-foreground">{replyTo.author.name}</span>
        <span className="line-clamp-2">{text}</span>
      </span>
    </a>
  );
}

/** A meeting report as HR sent it. */
export function ReportCard({
  report,
  attachments,
}: {
  report: NonNullable<ThreadMessage["report"]>;
  attachments: ThreadMessage["attachments"];
}) {
  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-xs">
      <header className="flex flex-wrap items-start gap-3 border-b bg-brand-navy px-4 py-3 text-white">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
          <NotebookPen className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium tracking-wide text-white/70 uppercase">Meeting report</p>
          <h3 className="font-semibold">{report.title}</h3>
        </div>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs">{formatCalendarDate(report.meetingDate)}</span>
      </header>
      <div className="space-y-4 px-4 py-4 text-sm">
        {report.attendees.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Users className="size-3.5" /> Attended ({report.attendees.length})
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {report.attendees.map((a) => (
                <li key={a.id} className="flex items-center gap-1.5 rounded-full border bg-muted/40 py-0.5 pr-2.5 pl-0.5 text-xs">
                  <UserAvatar name={a.name} id={a.id} image={a.image} size="xs" className="size-5" />
                  {a.name}
                </li>
              ))}
            </ul>
          </div>
        )}
        <ReportSection label="What was discussed" text={report.discussed} />
        <ReportSection label="Decisions" text={report.decisions} />
        <ReportSection label="Action items" text={report.actionItems} />
        <AttachmentGallery attachments={attachments} />
      </div>
    </article>
  );
}

function ReportSection({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <section>
      <h4 className="mb-1 text-xs font-medium text-muted-foreground">{label}</h4>
      <p className="leading-relaxed break-words whitespace-pre-wrap">{text}</p>
    </section>
  );
}
