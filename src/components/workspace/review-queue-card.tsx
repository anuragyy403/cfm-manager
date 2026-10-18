import Link from "next/link";
import { ArrowRight, Hourglass } from "lucide-react";
import { TaskListItem } from "@/components/tasks/task-list-item";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelative } from "@/lib/format";
import type { listReviewQueue } from "@/server/tasks";

/**
 * Work handed in and waiting for this lead to pass or fail, oldest first.
 * Renders nothing when the queue is empty.
 */
export function ReviewQueueCard({
  tasks,
  base,
  description,
}: {
  tasks: Awaited<ReturnType<typeof listReviewQueue>>;
  base: string;
  description: string;
}) {
  if (tasks.length === 0) return null;
  return (
    <Card className="border-violet-300 dark:border-violet-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hourglass className="size-5 text-violet-600" />
          Waiting for your review
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 tabular-nums dark:bg-violet-950 dark:text-violet-300">
            {tasks.length}
          </span>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Button asChild variant="ghost" size="sm">
            <Link href={`${base}/tasks?view=SUBMITTED`}>
              All in review <ArrowRight />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.map((t) => (
          <TaskListItem
            key={t.id}
            task={t}
            href={`${base}/tasks/${t.id}`}
            assignee={t.assignee}
            context={t.submittedAt ? `Submitted ${formatRelative(t.submittedAt)}` : undefined}
          />
        ))}
      </CardContent>
    </Card>
  );
}
