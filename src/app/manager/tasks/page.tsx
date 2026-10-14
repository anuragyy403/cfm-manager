import type { Metadata } from "next";
import { TasksView } from "@/components/workspace/views/tasks-view";
import { requireManager } from "@/server/session";

export const metadata: Metadata = { title: "Team tasks" };

export default async function ManagerTasksPage({ searchParams }: PageProps<"/manager/tasks">) {
  const manager = await requireManager();
  return <TasksView viewer={manager} base="/manager" searchParams={await searchParams} />;
}
