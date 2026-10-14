import type { Metadata } from "next";
import { TaskDetailView } from "@/components/workspace/views/task-detail-view";
import { requireOwner } from "@/server/session";

export const metadata: Metadata = { title: "Task" };

export default async function OwnerTaskPage({ params }: PageProps<"/admin/tasks/[id]">) {
  const owner = await requireOwner();
  const { id } = await params;
  return <TaskDetailView viewer={owner} base="/admin" id={id} />;
}
