import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  CheckCircle2,
  CirclePlay,
  Pencil,
  ListTree,
  PlusCircle,
  RotateCcw,
  UserRoundPen,
} from "lucide-react";
import type { TaskActivityType } from "@/generated/prisma/client";
import { UserAvatar } from "@/components/user-avatar";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export type FeedActivity = {
  id: string;
  type: TaskActivityType;
  details: unknown;
  createdAt: Date;
  actor: { id: string; name: string };
  task?: { id: string; title: string };
};

const icons: Record<TaskActivityType, typeof Pencil> = {
  CREATED: PlusCircle,
  UPDATED: Pencil,
  REASSIGNED: UserRoundPen,
  STARTED: CirclePlay,
  COMPLETED: CheckCircle2,
  REOPENED: RotateCcw,
  ARCHIVED: Archive,
  RESTORED: ArchiveRestore,
  SUBTASK_ADDED: ListTree,
};

const badgeTone: Record<TaskActivityType, string> = {
  CREATED: "bg-brand-navy text-white",
  UPDATED: "bg-slate-500 text-white",
  REASSIGNED: "bg-violet-500 text-white",
  STARTED: "bg-sky-500 text-white",
  COMPLETED: "bg-emerald-500 text-white",
  REOPENED: "bg-amber-500 text-white",
  ARCHIVED: "bg-slate-400 text-white",
  RESTORED: "bg-slate-500 text-white",
  SUBTASK_ADDED: "bg-brand-orange text-white",
};

type Details = {
  fields?: string[];
  fromAssigneeId?: string;
  toAssigneeId?: string;
  onTime?: boolean;
  reason?: string;
  title?: string;
  assigneeId?: string;
  withParent?: boolean;
};

function describe(a: FeedActivity, names: Record<string, string>) {
  const d = (a.details ?? {}) as Details;
  switch (a.type) {
    case "CREATED":
      return "created and assigned the task";
    case "UPDATED":
      return `updated ${d.fields?.join(", ") ?? "the task"}`;
    case "REASSIGNED": {
      const from = (d.fromAssigneeId && names[d.fromAssigneeId]) || "previous assignee";
      const to = (d.toAssigneeId && names[d.toAssigneeId]) || "a new assignee";
      return `reassigned from ${from} to ${to}`;
    }
    case "STARTED":
      return "started working on it";
    case "COMPLETED":
      return d.onTime === false ? "marked it completed (late)" : "marked it completed";
    case "REOPENED":
      return "reopened the task";
    case "ARCHIVED":
      return d.withParent ? "archived the task together with its main task" : "archived the task";
    case "RESTORED":
      return "restored the task";
    case "SUBTASK_ADDED": {
      const who = (d.assigneeId && names[d.assigneeId]) || "a team member";
      return `added a subtask “${d.title ?? "Untitled"}” for ${who}`;
    }
  }
}

export function ActivityFeed({
  activities,
  names = {},
  taskHref,
  emptyText = "No activity yet.",
}: {
  activities: FeedActivity[];
  /** userId → name, used to describe reassignments and subtasks. */
  names?: Record<string, string>;
  /** When set, each entry links to its task. */
  taskHref?: (taskId: string) => string;
  emptyText?: string;
}) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-4 before:w-px before:bg-border">
      {activities.map((a) => {
        const Icon = icons[a.type];
        const reason = a.type === "REOPENED" ? (a.details as Details | null)?.reason : undefined;
        return (
          <li key={a.id} className="relative flex gap-3">
            <div className="relative shrink-0">
              <UserAvatar name={a.actor.name} id={a.actor.id} className="ring-4 ring-card" />
              <span
                className={cn(
                  "absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full ring-2 ring-card",
                  badgeTone[a.type],
                )}
              >
                <Icon className="size-2.5" />
              </span>
            </div>
            <div className="min-w-0 pt-0.5 text-sm">
              <p>
                <span className="font-medium">{a.actor.name}</span> {describe(a, names)}
                {a.task && taskHref && (
                  <>
                    {" "}
                    <Link
                      href={taskHref(a.task.id)}
                      className="font-medium text-brand-orange-hover hover:underline"
                    >
                      {a.task.title}
                    </Link>
                  </>
                )}
              </p>
              {reason && <p className="mt-1 rounded-md bg-muted/60 px-2 py-1 text-muted-foreground">“{reason}”</p>}
              <p className="text-xs text-muted-foreground" title={formatDateTime(a.createdAt)}>
                {formatRelative(a.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
