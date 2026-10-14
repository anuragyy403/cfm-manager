import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { EmptyIllustration } from "@/components/illustrations";
import { PageHeader } from "@/components/page-header";
import { TaskListItem } from "@/components/tasks/task-list-item";
import { displayStatus } from "@/lib/tasks/rules";
import { cn } from "@/lib/utils";
import type { CurrentUser } from "@/server/session";
import { listMyTasks } from "@/server/tasks";

const VIEWS = [
  { value: "all", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "COMPLETED", label: "Completed" },
] as const;
type View = (typeof VIEWS)[number]["value"];

/**
 * Tasks assigned to the signed-in person (employee or manager), with status
 * tabs. `listPath` is this page; `taskHref` builds each task's link.
 */
export async function MyTasksView({
  user,
  viewParam,
  listPath,
  taskBase,
  description,
}: {
  user: CurrentUser;
  viewParam: string | string[] | undefined;
  listPath: string;
  /** Task links go to `${taskBase}/${id}`. */
  taskBase: string;
  description: string;
}) {
  const view: View = VIEWS.some((v) => v.value === viewParam) ? (viewParam as View) : "all";

  // One query; the tabs filter by derived status so counts stay consistent.
  const all = await listMyTasks(user);
  const now = new Date();
  const counts: Record<View, number> = { all: all.length, PENDING: 0, IN_PROGRESS: 0, OVERDUE: 0, COMPLETED: 0 };
  for (const t of all) counts[displayStatus(t, now)]++;
  const tasks = view === "all" ? all : all.filter((t) => displayStatus(t, now) === view);
  if (view === "COMPLETED") tasks.sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime());

  return (
    <>
      <AutoRefresh />
      <PageHeader title="My tasks" description={description} />

      <nav className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-muted p-1 sm:w-fit" aria-label="Filter tasks">
        {VIEWS.map((v) => (
          <Link
            key={v.value}
            href={v.value === "all" ? listPath : `${listPath}?view=${v.value}`}
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
        <div className="flex flex-col items-center gap-2 rounded-2xl border bg-card py-14 text-center">
          <EmptyIllustration kind={all.length === 0 ? "tasks" : view === "OVERDUE" ? "done" : "search"} />
          <p className="mt-2 font-semibold">
            {view === "OVERDUE" && all.length > 0 ? "Nothing overdue" : "No tasks here"}
          </p>
          <p className="text-sm text-muted-foreground">
            {all.length === 0
              ? "You don't have any tasks yet."
              : view === "OVERDUE"
                ? "You're on top of every deadline. Nice work!"
                : "No tasks in this category."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <TaskListItem key={t.id} task={t} href={`${taskBase}/${t.id}`} context={t.parent ? `Part of ${t.parent.title}` : undefined} />
          ))}
        </div>
      )}
    </>
  );
}
