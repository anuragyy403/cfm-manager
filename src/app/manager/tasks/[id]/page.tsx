import type { Metadata } from "next";
import { TaskDetailView } from "@/components/workspace/views/task-detail-view";
import { requireManager } from "@/server/session";

export const metadata: Metadata = { title: "Task" };

export default async function ManagerTaskPage({ params }: PageProps<"/manager/tasks/[id]">) {
  const manager = await requireManager();
  const { id } = await params;
  return <TaskDetailView viewer={manager} base="/manager" id={id} />;
}
