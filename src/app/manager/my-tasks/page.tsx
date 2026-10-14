import type { Metadata } from "next";
import { MyTasksView } from "@/components/workspace/views/my-tasks-view";
import { requireManager } from "@/server/session";

export const metadata: Metadata = { title: "My tasks" };

export default async function ManagerMyTasksPage({ searchParams }: PageProps<"/manager/my-tasks">) {
  const manager = await requireManager();
  const { view } = await searchParams;
  return (
    <MyTasksView
      user={manager}
      viewParam={view}
      listPath="/manager/my-tasks"
      taskBase="/manager/tasks"
      description="Work assigned to you personally. Open a task to start it, complete it, or split it into subtasks for your team."
    />
  );
}
