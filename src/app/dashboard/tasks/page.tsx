import type { Metadata } from "next";
import { MyTasksView } from "@/components/workspace/views/my-tasks-view";
import { requireEmployee } from "@/server/session";

export const metadata: Metadata = { title: "My tasks" };

export default async function MyTasksPage({ searchParams }: PageProps<"/dashboard/tasks">) {
  const employee = await requireEmployee();
  const { view } = await searchParams;
  return (
    <MyTasksView
      user={employee}
      viewParam={view}
      listPath="/dashboard/tasks"
      taskBase="/dashboard/tasks"
      description="Everything your manager has assigned to you."
    />
  );
}
