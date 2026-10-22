import { BadgeCheck, Hourglass, MessageSquareText, RotateCcw } from "lucide-react";
import type { TaskActivityType } from "@/generated/prisma/client";
import { AttachmentGallery } from "@/components/attachments/attachment-gallery";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttachmentView } from "@/lib/attachments";
import { formatDateTime, formatRelative } from "@/lib/format";
import { changesRequested, type TaskStatus } from "@/lib/tasks/rules";
import { cn } from "@/lib/utils";
import { DueChip } from "./due-chip";

type ReviewTask = {
  status: TaskStatus;
  dueAt: Date;
  submittedAt: Date | null;
  completedAt: Date | null;
  completionNote: string | null;
  reviewNote: string | null;
  timesFailed: number;
};

type ReviewActivity = { type: TaskActivityType; actor: { name: string }; attachments?: AttachmentView[] };

/**
 * Where the work stands in review, for both the assignee and the reviewer:
 * waiting for review (with what was delivered), sent back (with the
 * feedback to act on), or passed. Renders nothing while the work is still
 * being done for the first time.
 */
export function ReviewCard({
  task,
  activities,
  viewer,
  assigneeName,
  reviewer,
  actions,
}: {
  task: ReviewTask;
  /** The task's history, newest first: used to say who reviewed it. */
  activities: ReviewActivity[];
  /** Whose screen this is, so the wording speaks to them. */
  viewer: "assignee" | "lead";
  assigneeName: string;
  /** Who reviews it, e.g. "Rahul Khanna" or "the owner". */
  reviewer: string;
  /** Pass / Fail buttons, when the viewer is the reviewer. */
  actions?: React.ReactNode;
}) {
  const lastVerdict = activities.find((a) => a.type === "PASSED" || a.type === "FAILED" || a.type === "REOPENED");
  const verdictBy = lastVerdict?.actor.name ?? reviewer;
  const you = viewer === "assignee";
  // Files from the latest hand-in, and from the verdict on it.
  const handedIn = activities.find((a) => a.type === "SUBMITTED")?.attachments ?? [];
  const verdictFiles = lastVerdict?.attachments ?? [];

  if (task.status === "SUBMITTED") {
    return (
      <Card className="border-violet-200 dark:border-violet-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hourglass className="size-4 text-violet-600" />
            {you ? `Waiting for ${reviewer} to review` : `${assigneeName} submitted this for review`}
          </CardTitle>
          <CardDescription>
            {task.submittedAt && `Submitted ${formatRelative(task.submittedAt)} · ${formatDateTime(task.submittedAt)}`}
            {task.timesFailed > 0 && ` · try ${task.timesFailed + 1}`}
          </CardDescription>
          <CardAction>
            <DueChip task={task} />
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          <Delivered note={task.completionNote} label={you ? "What you delivered" : "What they delivered"} files={handedIn} />
          {actions ? (
            <div className="flex flex-wrap gap-2 border-t pt-4">{actions}</div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {you
                ? "It counts as done once it passes. You'll get a notification either way."
                : reviewer === "you"
                  ? "You review this task."
                  : `${capitaliseFirst(reviewer)} reviews this task.`}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (changesRequested(task) && task.reviewNote) {
    return (
      <Card className="border-amber-300 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="size-4 text-amber-600" />
            {you ? `${verdictBy} sent this back` : `Sent back to ${assigneeName}`}
          </CardTitle>
          <CardDescription>
            {lastVerdict?.type === "REOPENED" ? "Reopened after it was completed." : "Changes requested."}{" "}
            {you ? "Make the changes, then resubmit it for review." : "Waiting for them to resubmit."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Quote by={verdictBy} tone="amber" files={verdictFiles}>
            {task.reviewNote}
          </Quote>
        </CardContent>
      </Card>
    );
  }

  if (task.status === "COMPLETED") {
    const passed = lastVerdict?.type === "PASSED";
    return (
      <Card className="border-emerald-200 dark:border-emerald-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {passed ? (
              <BadgeCheck className="size-4 text-emerald-600" />
            ) : (
              <MessageSquareText className="size-4 text-emerald-600" />
            )}
            {passed ? `Passed by ${verdictBy}` : "Completed"}
          </CardTitle>
          <CardDescription>
            {task.completedAt && formatDateTime(task.completedAt)}
            {passed && (task.timesFailed ? ` · after ${plural(task.timesFailed, "redo")}` : " · passed first time")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Delivered
            note={task.completionNote}
            label={you ? "What you delivered" : `What ${assigneeName} delivered`}
            files={passed ? handedIn : []}
          />
          {(task.reviewNote || (passed && verdictFiles.length > 0)) && (
            <Quote by={verdictBy} tone="emerald" files={passed ? verdictFiles : []}>
              {task.reviewNote || <span className="text-muted-foreground">No written feedback.</span>}
            </Quote>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
}

function Delivered({ note, label, files }: { note: string | null; label: string; files: AttachmentView[] }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">
        {note || <span className="text-muted-foreground">No note.</span>}
      </p>
      <AttachmentGallery attachments={files} className="mt-3" />
    </div>
  );
}

function Quote({
  by,
  tone,
  files,
  children,
}: {
  by: string;
  tone: "amber" | "emerald";
  files: AttachmentView[];
  children: React.ReactNode;
}) {
  return (
    <figure
      className={cn(
        "rounded-lg border-l-4 bg-card px-4 py-3",
        tone === "amber" ? "border-l-amber-500" : "border-l-emerald-500",
      )}
    >
      <blockquote className="text-sm leading-relaxed whitespace-pre-wrap">{children}</blockquote>
      <AttachmentGallery attachments={files} className="mt-3" />
      <figcaption className="mt-2 text-xs text-muted-foreground">— {by}</figcaption>
    </figure>
  );
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function capitaliseFirst(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
