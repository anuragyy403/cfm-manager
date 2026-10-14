import type { Metadata } from "next";
import { TasksView } from "@/components/workspace/views/tasks-view";
import { requireOwner } from "@/server/session";

export const metadata: Metadata = { title: "Tasks" };

export default async function OwnerTasksPage({ searchParams }: PageProps<"/admin/tasks">) {
  const owner = await requireOwner();
  return <TasksView viewer={owner} base="/admin" searchParams={await searchParams} />;
}
