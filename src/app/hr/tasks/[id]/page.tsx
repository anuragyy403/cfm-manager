import type { Metadata } from "next";
import { TaskDetailView } from "@/components/workspace/views/task-detail-view";
import { requireHR } from "@/server/session";

export const metadata: Metadata = { title: "Task" };

export default async function HRTaskPage({ params }: PageProps<"/hr/tasks/[id]">) {
  const hr = await requireHR();
  const { id } = await params;
  return <TaskDetailView viewer={hr} base="/hr" id={id} />;
}
