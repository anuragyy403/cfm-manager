import type { Metadata } from "next";
import { TasksView } from "@/components/workspace/views/tasks-view";
import { requireHR } from "@/server/session";

export const metadata: Metadata = { title: "All tasks" };

export default async function HRTasksPage({ searchParams }: PageProps<"/hr/tasks">) {
  const hr = await requireHR();
  return <TasksView viewer={hr} base="/hr" searchParams={await searchParams} />;
}
