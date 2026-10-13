import type { Metadata } from "next";
import { AutoRefresh } from "@/components/auto-refresh";
import { EmptyIllustration } from "@/components/illustrations";
import { PageHeader } from "@/components/page-header";
import { TaskBoard } from "@/components/tasks/task-board";
import { TaskTable } from "@/components/tasks/task-table";
import { Card, CardContent } from "@/components/ui/card";
import { TASK_PRIORITIES } from "@/lib/tasks/rules";
import { requireAdmin } from "@/server/session";
import { countTeamTasksByView, listTeamTasks, TASK_VIEWS, type TaskView } from "@/server/tasks";
import { getAdminTeam, listMemberOptions } from "@/server/teams";
import { NewTaskButton } from "./new-task-button";
import { TaskFilters } from "./task-filters";

export const metadata: Metadata = { title: "Tasks" };

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminTasksPage({ searchParams }: PageProps<"/admin/tasks">) {
  const admin = await requireAdmin();
  const sp = await searchParams;

  const layout = one(sp.layout) === "board" ? "board" : "table";
  const viewParam = one(sp.view);
  const view: TaskView = TASK_VIEWS.includes(viewParam as TaskView) ? (viewParam as TaskView) : "all";
  const priorityParam = one(sp.priority);
  const priority = TASK_PRIORITIES.includes(priorityParam as never) ? priorityParam : undefined;
  const assigneeId = one(sp.assignee)?.slice(0, 64);
  const q = one(sp.q)?.slice(0, 100);

  const team = await getAdminTeam(admin);
  const [memberOptions, tasks, counts] = await Promise.all([
    team ? listMemberOptions(team.id) : Promise.resolve([]),
    // The board shows every active task split into status columns.
    listTeamTasks(admin, { view: layout === "board" ? "all" : view, priority, assigneeId, q }),
    countTeamTasksByView(admin),
  ]);

  return (
    <>
      <AutoRefresh />
      <PageHeader
        title="Tasks"
        description="Every task across your team: who owns it, its status and its deadline."
        actions={<NewTaskButton members={memberOptions} />}
      />
      <div className="space-y-4">
        <TaskFilters members={memberOptions} counts={counts} layout={layout} />
        {tasks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
              <EmptyIllustration kind={counts.all === 0 ? "tasks" : "search"} />
              <p className="mt-2 font-semibold">{counts.all === 0 ? "No tasks yet" : "No tasks here"}</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {counts.all === 0
                  ? "Create your first task and assign it to a team member. It shows up on their dashboard straight away."
                  : "No tasks match these filters. Try another tab or clear the filters."}
              </p>
              {counts.all === 0 && (
                <div className="mt-3">
                  <NewTaskButton members={memberOptions} />
                </div>
              )}
            </CardContent>
          </Card>
        ) : layout === "board" ? (
          <TaskBoard tasks={tasks} />
        ) : (
          <Card className="py-0">
            <CardContent className="p-0">
              <TaskTable tasks={tasks} />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
