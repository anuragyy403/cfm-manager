import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHeader } from "@/components/page-header";
import { TaskTable } from "@/components/tasks/task-table";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { TASK_PRIORITIES } from "@/lib/tasks/rules";
import { requireAdmin } from "@/server/session";
import { countTeamTasksByView, listTeamTasks, TASK_VIEWS, type TaskView } from "@/server/tasks";
import { getAdminTeam, listTeamMembers } from "@/server/teams";
import { NewTaskButton } from "./new-task-button";
import { TaskFilters } from "./task-filters";

export const metadata: Metadata = { title: "Tasks" };

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminTasksPage({ searchParams }: PageProps<"/admin/tasks">) {
  const admin = await requireAdmin();
  const sp = await searchParams;

  const viewParam = one(sp.view);
  const view: TaskView = TASK_VIEWS.includes(viewParam as TaskView) ? (viewParam as TaskView) : "all";
  const priorityParam = one(sp.priority);
  const priority = TASK_PRIORITIES.includes(priorityParam as never) ? priorityParam : undefined;
  const assigneeId = one(sp.assignee)?.slice(0, 64);
  const q = one(sp.q)?.slice(0, 100);

  const team = await getAdminTeam(admin);
  const [members, tasks, counts] = await Promise.all([
    team ? listTeamMembers(team.id) : Promise.resolve([]),
    listTeamTasks(admin, { view, priority, assigneeId, q }),
    countTeamTasksByView(admin),
  ]);
  const memberOptions = members.map((m) => ({ id: m.user.id, name: m.user.name, username: m.user.username }));

  return (
    <>
      <AutoRefresh />
      <PageHeader
        title="Tasks"
        description="Every task across your team: who owns it, its status and its deadline."
        actions={<NewTaskButton members={memberOptions} />}
      />
      <div className="space-y-4">
        <TaskFilters members={memberOptions} counts={counts} />
        <Card className="py-0">
          <CardContent className="p-0">
            {tasks.length === 0 ? (
              <Empty className="py-16">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ClipboardList />
                  </EmptyMedia>
                  <EmptyTitle>No tasks here</EmptyTitle>
                  <EmptyDescription>
                    {counts.all === 0
                      ? "Create your first task and assign it to a team member."
                      : "No tasks match these filters."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <TaskTable tasks={tasks} />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
