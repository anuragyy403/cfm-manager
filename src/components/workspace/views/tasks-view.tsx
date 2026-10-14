import { AutoRefresh } from "@/components/auto-refresh";
import { EmptyIllustration } from "@/components/illustrations";
import { PageHeader } from "@/components/page-header";
import { TaskBoard } from "@/components/tasks/task-board";
import { TaskTable } from "@/components/tasks/task-table";
import { Card, CardContent } from "@/components/ui/card";
import { TASK_PRIORITIES } from "@/lib/tasks/rules";
import { isOwner } from "@/server/access";
import type { CurrentUser } from "@/server/session";
import { countTasksByView, listTasks, TASK_VIEWS, type TaskView } from "@/server/tasks";
import { listAssignableTeams } from "@/server/teams";
import { NewTaskButton } from "../new-task-button";
import { TaskFilters } from "../task-filters";

type SearchParams = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

/** Every task across the lead's teams, as a filterable table or a board. */
export async function TasksView({
  viewer,
  base,
  searchParams,
}: {
  viewer: CurrentUser;
  base: string;
  searchParams: SearchParams;
}) {
  const sp = searchParams;
  const layout = one(sp.layout) === "board" ? "board" : "table";
  const viewParam = one(sp.view);
  const view: TaskView = TASK_VIEWS.includes(viewParam as TaskView) ? (viewParam as TaskView) : "all";
  const priorityParam = one(sp.priority);
  const priority = TASK_PRIORITIES.includes(priorityParam as never) ? priorityParam : undefined;
  const assigneeId = one(sp.assignee)?.slice(0, 64);
  const teamId = one(sp.team)?.slice(0, 64);
  const q = one(sp.q)?.slice(0, 100);

  const [teams, tasks, counts] = await Promise.all([
    listAssignableTeams(viewer),
    // The board shows every active task split into status columns.
    listTasks(viewer, { view: layout === "board" ? "all" : view, priority, assigneeId, teamId, q }),
    countTasksByView(viewer, { teamId }),
  ]);

  // People to filter by: everyone who can get work in the chosen team(s).
  const shownTeams = teamId ? teams.filter((t) => t.id === teamId) : teams;
  const people = [...new Map(shownTeams.flatMap((t) => t.people).map((p) => [p.id, p])).values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <>
      <AutoRefresh />
      <PageHeader
        title={isOwner(viewer) ? "All tasks" : "Team tasks"}
        description={
          isOwner(viewer)
            ? "Every task in the company: which team, who owns it, its status and its deadline."
            : "Every task in your teams, including work the owner assigned."
        }
        actions={<NewTaskButton teams={teams} base={base} defaultTeamId={teamId} />}
      />
      <div className="space-y-4">
        <TaskFilters members={people} teams={teams} counts={counts} layout={layout} />
        {tasks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
              <EmptyIllustration kind={counts.all === 0 ? "tasks" : "search"} />
              <p className="mt-2 font-semibold">{counts.all === 0 ? "No tasks yet" : "No tasks here"}</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {counts.all === 0
                  ? "Create the first task and assign it. It shows up on their dashboard straight away."
                  : "No tasks match these filters. Try another tab or clear the filters."}
              </p>
              {counts.all === 0 && (
                <div className="mt-3">
                  <NewTaskButton teams={teams} base={base} />
                </div>
              )}
            </CardContent>
          </Card>
        ) : layout === "board" ? (
          <TaskBoard tasks={tasks} base={base} />
        ) : (
          <Card className="py-0">
            <CardContent className="p-0">
              <TaskTable tasks={tasks} base={base} showTeam={teams.length > 1} />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
