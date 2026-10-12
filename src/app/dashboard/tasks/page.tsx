import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHeader } from "@/components/page-header";
import { TaskListItem } from "@/components/tasks/task-list-item";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { displayStatus } from "@/lib/tasks/rules";
import { cn } from "@/lib/utils";
import { requireMember } from "@/server/session";
import { listMyTasks } from "@/server/tasks";

export const metadata: Metadata = { title: "My tasks" };

const VIEWS = [
  { value: "all", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "COMPLETED", label: "Completed" },
] as const;
type View = (typeof VIEWS)[number]["value"];

export default async function MyTasksPage({ searchParams }: PageProps<"/dashboard/tasks">) {
  const member = await requireMember();
  const { view: viewParam } = await searchParams;
  const view: View = VIEWS.some((v) => v.value === viewParam) ? (viewParam as View) : "all";

  // One query; the tabs filter by derived status so counts stay consistent.
  const all = await listMyTasks(member);
  const now = new Date();
  const counts: Record<View, number> = { all: all.length, PENDING: 0, IN_PROGRESS: 0, OVERDUE: 0, COMPLETED: 0 };
  for (const t of all) counts[displayStatus(t, now)]++;
  const tasks = view === "all" ? all : all.filter((t) => displayStatus(t, now) === view);
  if (view === "COMPLETED") tasks.sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime());

  return (
    <>
      <AutoRefresh />
      <PageHeader title="My tasks" description="Everything your manager has assigned to you." />

      <nav className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-muted p-1 sm:w-fit" aria-label="Filter tasks">
        {VIEWS.map((v) => (
          <Link
            key={v.value}
            href={v.value === "all" ? "/dashboard/tasks" : `/dashboard/tasks?view=${v.value}`}
            scroll={false}
            aria-current={view === v.value ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              view === v.value && "bg-background text-foreground shadow-sm",
            )}
          >
            {v.label}
            <span className="rounded-full bg-muted-foreground/10 px-1.5 text-xs tabular-nums">{counts[v.value]}</span>
          </Link>
        ))}
      </nav>

      {tasks.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>No tasks here</EmptyTitle>
            <EmptyDescription>
              {all.length === 0 ? "You don't have any tasks yet." : "No tasks in this category."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <TaskListItem key={t.id} task={t} href={`/dashboard/tasks/${t.id}`} />
          ))}
        </div>
      )}
    </>
  );
}
