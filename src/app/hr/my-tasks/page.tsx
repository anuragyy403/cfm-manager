import type { Metadata } from "next";
import { MyTasksView } from "@/components/workspace/views/my-tasks-view";
import { requireHR } from "@/server/session";

export const metadata: Metadata = { title: "My tasks" };

export default async function HRMyTasksPage({ searchParams }: PageProps<"/hr/my-tasks">) {
  const hr = await requireHR();
  const { view } = await searchParams;
  return (
    <MyTasksView
      user={hr}
      viewParam={view}
      listPath="/hr/my-tasks"
      taskBase="/hr/tasks"
      description="Work the owner gave you. Open a task to start it, hand it in for review, or split it into subtasks."
    />
  );
}
