import Link from "next/link";
import { ArrowLeft, CalendarDays, EyeOff, Lock, NotebookPen, Tag, UserRound } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { DeletedTag } from "@/components/deleted-tag";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { CATEGORY_LABELS } from "@/lib/conversations";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/roles";
import { isHR, isOwner } from "@/server/access";
import { findOwner, getConversation, listMeetingAttendeeOptions } from "@/server/conversations";
import type { CurrentUser } from "@/server/session";
import { CaseStatusActions } from "../case-status-actions";
import { CaseStatusBadge, UrgentTag } from "../case-badges";
import { Composer } from "../composer";
import { ReportFormDialog } from "../report-form-dialog";
import { Thread } from "../thread";
import { MarkRead, ThreadProvider, ThreadScroller } from "../thread-client";

/**
 * One private conversation with the owner, as either side sees it: a case
 * ("Talk to the owner"), or an HR person's desk with their meeting reports.
 */
export async function ConversationView({ viewer, base, id }: { viewer: CurrentUser; base: string; id: string }) {
  const convo = await getConversation(viewer, id);
  const owner = isOwner(viewer);
  const isCase = convo.kind === "OWNER_CASE";
  const theOwner = owner ? null : await findOwner();
  const otherName = owner ? convo.creator.name.split(" ")[0]! : (theOwner?.name.split(" ")[0] ?? "the owner");
  const closed = convo.status === "WITHDRAWN";
  // HR writes reports on their own desk; the owner only reads and replies.
  const writesReports = !isCase && !owner && isHR(viewer);
  const attendeeOptions = writesReports ? await listMeetingAttendeeOptions() : [];
  const team = convo.creator.memberships[0]?.team.name;

  const back = owner
    ? { href: isCase ? "/admin/inbox" : "/admin/inbox?tab=hr", label: "Inbox" }
    : isCase
      ? { href: `${base}/talk`, label: "Talk to the owner" }
      : null;

  return (
    <ThreadProvider>
      <AutoRefresh intervalMs={10_000} />
      <MarkRead conversationId={convo.id} lastMessageAt={convo.lastMessageAt.toISOString()} />
      {back && (
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4">
          <Link href={back.href}>
            <ArrowLeft />
            {back.label}
          </Link>
        </Button>
      )}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-3">
          {isCase && (
            <div className="flex flex-wrap items-center gap-2">
              <CaseStatusBadge status={convo.status} forOwner={owner} />
              {convo.urgency === "URGENT" && !closed && <UrgentTag />}
            </div>
          )}
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {isCase ? convo.subject : owner ? `HR desk · ${convo.creator.name}` : "Meeting reports"}
          </h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Lock className="size-3.5 shrink-0" />
            {owner
              ? `Private between you and ${convo.creator.name}.`
              : `Private between you and ${theOwner?.name ?? "the owner"}. Nobody else can see it.`}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {owner && isCase && <CaseStatusActions conversationId={convo.id} status={convo.status} raiserName={convo.creator.name} />}
          {writesReports && <ReportFormDialog people={attendeeOptions} />}
        </div>
      </div>

      {closed && (
        <Alert className="mb-6">
          <EyeOff />
          <AlertTitle>Withdrawn</AlertTitle>
          <AlertDescription>
            {owner
              ? `${convo.creator.name} took this concern back right after sending it.`
              : "You took this concern back. Raise a new one any time."}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="gap-0 overflow-hidden py-0 lg:col-span-2">
          <ThreadScroller count={convo.messages.length}>
            {convo.messages.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-orange-soft text-sun-deep">
                  <NotebookPen className="size-6" />
                </span>
                <p className="mt-2 font-semibold">{owner ? "No reports yet" : "Send your first meeting report"}</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {owner
                    ? `${convo.creator.name}'s meeting reports and messages will appear here.`
                    : "Use “New meeting report” after each meeting. You can also send the owner a quick message below."}
                </p>
              </div>
            ) : (
              <Thread
                messages={convo.messages}
                viewerId={viewer.id}
                otherReadAt={convo.otherReadAt}
                otherName={otherName}
                firstMessageId={convo.firstMessageId}
                isCase={isCase}
                closed={closed}
              />
            )}
          </ThreadScroller>
          {!closed && (
            <div className="border-t bg-muted/30 px-4 py-4 sm:px-6">
              <Composer
                conversationId={convo.id}
                placeholder={
                  owner
                    ? `Reply to ${convo.creator.name.split(" ")[0]}…`
                    : isCase
                      ? "Add more details or reply to the owner…"
                      : "Message the owner…"
                }
                privacyNote={owner ? `Only ${convo.creator.name.split(" ")[0]} sees your reply.` : "Only you and the owner can see this."}
              />
            </div>
          )}
        </Card>

        <div className="space-y-6">
          {(owner || !isCase) && (
            <Card>
              <CardHeader>
                <CardTitle>{isCase ? "Raised by" : "HR"}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <UserAvatar name={convo.creator.name} id={convo.creator.id} image={convo.creator.image} size="md" />
                  <div className="grid min-w-0 leading-tight">
                    <span className="font-medium">
                      {convo.creator.id === viewer.id ? `${convo.creator.name} (you)` : convo.creator.name}
                      {convo.creator.deletedAt && <DeletedTag />}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {ROLE_LABELS[convo.creator.role]}
                      {team ? ` · ${team}` : ""}
                    </span>
                    {owner && <span className="truncate text-sm text-muted-foreground">{convo.creator.email}</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {isCase && (
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Detail icon={Tag} label="About">
                  {convo.category ? CATEGORY_LABELS[convo.category] : "—"}
                </Detail>
                <Detail icon={UserRound} label="Who it's about">
                  {convo.aboutUser ? (
                    <>
                      {convo.aboutUser.name} ({ROLE_LABELS[convo.aboutUser.role]})
                      {convo.aboutUser.deletedAt && <DeletedTag />}
                    </>
                  ) : (
                    "No one in particular"
                  )}
                </Detail>
                <Detail icon={CalendarDays} label="Raised">
                  {formatDateTime(convo.createdAt)}
                  {convo.resolvedAt && convo.status === "RESOLVED" && ` · resolved ${formatDateTime(convo.resolvedAt)}`}
                </Detail>
                {!owner && convo.aboutUser && (
                  <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                    {convo.aboutUser.name} can&apos;t see this and isn&apos;t told about it.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
          {writesReports && (
            <Link
              href={`${base}/talk`}
              className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-sm transition hover:-translate-y-px hover:shadow-sm"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-navy text-white">
                <Lock className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block font-medium">A problem of your own?</span>
                <span className="block text-muted-foreground">Raise it privately under Talk to the owner.</span>
              </span>
            </Link>
          )}
          <p className="px-1 text-xs text-muted-foreground">
            You can delete your own message in the first 5 minutes after sending it. After that it stays on record.
            {isCase && !owner && " Deleting your first message withdraws the whole concern."}
          </p>
        </div>
      </div>
    </ThreadProvider>
  );
}

function Detail({ icon: Icon, label, children }: { icon: typeof Tag; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p>{children}</p>
      </div>
    </div>
  );
}
