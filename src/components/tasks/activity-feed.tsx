import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  CheckCircle2,
  CirclePlay,
  Pencil,
  PlusCircle,
  RotateCcw,
  UserRoundPen,
} from "lucide-react";
import type { TaskActivityType } from "@/generated/prisma/client";
import { formatDateTime, formatRelative } from "@/lib/format";

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
};

type Details = {
  fields?: string[];
  fromAssigneeId?: string;
  toAssigneeId?: string;
  onTime?: boolean;
  reason?: string;
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
      return "archived the task";
    case "RESTORED":
      return "restored the task";
  }
}

export function ActivityFeed({
  activities,
  names = {},
  taskHref,
  emptyText = "No activity yet.",
}: {
  activities: FeedActivity[];
  /** userId → name, used to describe reassignments. */
  names?: Record<string, string>;
  /** When set, each entry links to its task. */
  taskHref?: (taskId: string) => string;
  emptyText?: string;
}) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ol className="space-y-4">
      {activities.map((a) => {
        const Icon = icons[a.type];
        const reason = a.type === "REOPENED" ? (a.details as Details | null)?.reason : undefined;
        return (
          <li key={a.id} className="flex gap-3">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Icon className="size-3.5" />
            </div>
            <div className="min-w-0 text-sm">
              <p>
                <span className="font-medium">{a.actor.name}</span> {describe(a, names)}
                {a.task && taskHref && (
                  <>
                    {" "}
                    <Link href={taskHref(a.task.id)} className="font-medium text-primary hover:underline">
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
