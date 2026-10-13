"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { PRIORITY_LABELS, TASK_PRIORITIES, type TaskPriority } from "@/lib/tasks/rules";
import { cn } from "@/lib/utils";
import { createTaskAction, updateTaskAction } from "@/server/actions/admin";

export type MemberOption = {
  id: string;
  name: string;
  username: string | null;
  /** Open (not completed) tasks already assigned; shown as a workload hint. */
  openTasks?: number;
};

export type EditableTask = {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueAt: string; // ISO
  assigneeId: string;
  completed: boolean;
};

export function TaskFormDialog({
  open,
  onOpenChange,
  members,
  task,
  defaultAssigneeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: MemberOption[];
  /** When set the dialog edits this task; otherwise it creates a new one. */
  task?: EditableTask;
  /** Pre-selects the assignee for a new task (e.g. from a member's profile). */
  defaultAssigneeId?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? defaultAssigneeId ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "MEDIUM");

  const editing = !!task;
  const minDue = format(new Date(), "yyyy-MM-dd'T'HH:mm");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const dueLocal = String(form.get("dueAt") ?? "");
    const due = dueLocal ? new Date(dueLocal) : null;

    const input = {
      title: form.get("title"),
      description: form.get("description"),
      priority,
      // datetime-local has no timezone; convert using the browser's timezone.
      dueAt: due && !Number.isNaN(due.getTime()) ? due.toISOString() : "",
      assigneeId,
    };

    setPending(true);
    const res = editing ? await updateTaskAction(task.id, input) : await createTaskAction(input);
    setPending(false);

    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    setErrors({});
    onOpenChange(false);
    if (editing) {
      toast.success("Task updated");
    } else {
      toast.success("Task assigned", {
        description: `${members.find((m) => m.id === assigneeId)?.name ?? "The member"} can now see it on their dashboard.`,
      });
      if ("data" in res && res.data) router.push(`/admin/tasks/${(res.data as { id: string }).id}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Changes are recorded in the task's history."
              : "The task appears on the assignee's dashboard as soon as you create it."}
          </DialogDescription>
        </DialogHeader>
        <form id="task-form" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.title}>
              <FieldLabel htmlFor="title">Title</FieldLabel>
              <Input
                id="title"
                name="title"
                defaultValue={task?.title}
                placeholder="e.g. Develop the Company Landing Page"
                autoFocus
                aria-invalid={!!errors.title}
              />
              <FieldError>{errors.title}</FieldError>
            </Field>
            <Field data-invalid={!!errors.description}>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea
                id="description"
                name="description"
                defaultValue={task?.description}
                placeholder="What needs to be done, requirements, links…"
                rows={4}
              />
              <FieldError>{errors.description}</FieldError>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.assigneeId}>
                <FieldLabel htmlFor="assignee">Assign to</FieldLabel>
                <Select value={assigneeId} onValueChange={setAssigneeId} disabled={task?.completed}>
                  <SelectTrigger id="assignee" className="w-full" aria-invalid={!!errors.assigneeId}>
                    <SelectValue placeholder="Choose a member" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="flex w-full items-center gap-2">
                          <UserAvatar name={m.name} id={m.id} size="xs" />
                          <span className="truncate">{m.name}</span>
                          {m.openTasks !== undefined && (
                            <span
                              className={cn(
                                "ml-auto rounded-full px-1.5 text-[11px] tabular-nums",
                                m.openTasks >= 4
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {m.openTasks} open
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.assigneeId ? (
                  <FieldError>{errors.assigneeId}</FieldError>
                ) : task?.completed ? (
                  <FieldDescription>Reopen the task to reassign it.</FieldDescription>
                ) : editing ? (
                  <FieldDescription>Reassigning resets progress to pending.</FieldDescription>
                ) : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="priority">Priority</FieldLabel>
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger id="priority" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field data-invalid={!!errors.dueAt}>
              <FieldLabel htmlFor="dueAt">Deadline</FieldLabel>
              <Input
                id="dueAt"
                name="dueAt"
                type="datetime-local"
                min={editing ? undefined : minDue}
                defaultValue={task ? format(new Date(task.dueAt), "yyyy-MM-dd'T'HH:mm") : undefined}
                aria-invalid={!!errors.dueAt}
              />
              <FieldError>{errors.dueAt}</FieldError>
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="task-form" disabled={pending} variant={editing ? "default" : "brand"}>
            {pending && <Loader2 className="animate-spin" />}
            {editing ? "Save changes" : "Create & assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
