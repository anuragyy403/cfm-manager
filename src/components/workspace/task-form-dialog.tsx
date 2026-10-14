"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { format } from "date-fns";
import { CornerDownRight, Loader2 } from "lucide-react";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { PRIORITY_LABELS, TASK_PRIORITIES, type TaskPriority } from "@/lib/tasks/rules";
import { cn } from "@/lib/utils";
import { createTaskAction, updateTaskAction } from "@/server/actions/lead";

export type AssigneeOption = {
  id: string;
  name: string;
  username: string | null;
  /** Open (not completed) tasks already assigned; shown as a workload hint. */
  openTasks?: number;
  isManager?: boolean;
};

export type TeamOption = { id: string; name: string; people: AssigneeOption[] };

export type EditableTask = {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueAt: string; // ISO
  assigneeId: string;
  teamId: string;
  completed: boolean;
};

export function TaskFormDialog({
  open,
  onOpenChange,
  teams,
  base,
  task,
  parent,
  defaultAssigneeId,
  defaultTeamId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Teams the task can go to, each with the people who can be assigned. */
  teams: TeamOption[];
  /** Workspace to open the new task in, e.g. "/admin". */
  base: string;
  /** When set the dialog edits this task; otherwise it creates a new one. */
  task?: EditableTask;
  /** When set the new task is a subtask of this one (and stays in its team). */
  parent?: { id: string; title: string; teamId: string };
  /** Pre-selects the assignee for a new task (e.g. from someone's profile). */
  defaultAssigneeId?: string;
  defaultTeamId?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const initialTeam =
    task?.teamId ??
    parent?.teamId ??
    defaultTeamId ??
    (defaultAssigneeId ? teams.find((t) => t.people.some((p) => p.id === defaultAssigneeId))?.id : undefined) ??
    (teams.length === 1 ? teams[0]!.id : "");
  const [teamId, setTeamId] = useState(initialTeam);
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? defaultAssigneeId ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "MEDIUM");

  const editing = !!task;
  // The team is fixed when editing or adding a subtask; otherwise pick one (if there's a choice).
  const teamLocked = editing || !!parent;
  const people = teams.find((t) => t.id === teamId)?.people ?? [];
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
      teamId,
      ...(parent ? { parentId: parent.id } : {}),
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
      const who = people.find((m) => m.id === assigneeId)?.name ?? "They";
      toast.success(parent ? "Subtask assigned" : "Task assigned", {
        description: `${who} can now see it on their dashboard.`,
      });
      if (!parent && "data" in res && res.data) router.push(`${base}/tasks/${(res.data as { id: string }).id}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit task" : parent ? "New subtask" : "New task"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Changes are recorded in the task's history."
              : parent
                ? "Hand part of this task to someone on the team. It shows up under the main task."
                : "The task appears on the assignee's dashboard as soon as you create it."}
          </DialogDescription>
        </DialogHeader>
        {parent && (
          <p className="-mt-1 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
            <CornerDownRight className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              Part of <span className="font-medium">{parent.title}</span>
            </span>
          </p>
        )}
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
            {!teamLocked && teams.length > 1 && (
              <Field data-invalid={!!errors.teamId}>
                <FieldLabel htmlFor="team">Team</FieldLabel>
                <Select
                  value={teamId}
                  onValueChange={(v) => {
                    setTeamId(v);
                    // Keep the assignee only if they're also in the new team.
                    if (!teams.find((t) => t.id === v)?.people.some((p) => p.id === assigneeId)) setAssigneeId("");
                  }}
                >
                  <SelectTrigger id="team" className="w-full" aria-invalid={!!errors.teamId}>
                    <SelectValue placeholder="Choose a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError>{errors.teamId}</FieldError>
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.assigneeId}>
                <FieldLabel htmlFor="assignee">Assign to</FieldLabel>
                <Select
                  value={assigneeId}
                  onValueChange={setAssigneeId}
                  disabled={task?.completed || !teamId}
                >
                  <SelectTrigger id="assignee" className="w-full" aria-invalid={!!errors.assigneeId}>
                    <SelectValue placeholder={teamId ? "Choose a person" : "Choose a team first"} />
                  </SelectTrigger>
                  <SelectContent>
                    <PeopleGroup label="Manager" people={people.filter((p) => p.isManager)} />
                    <PeopleGroup label="Employees" people={people.filter((p) => !p.isManager)} />
                  </SelectContent>
                </Select>
                {errors.assigneeId ? (
                  <FieldError>{errors.assigneeId}</FieldError>
                ) : task?.completed ? (
                  <FieldDescription>Reopen the task to reassign it.</FieldDescription>
                ) : editing ? (
                  <FieldDescription>Reassigning resets progress to pending.</FieldDescription>
                ) : teamId && people.length === 0 ? (
                  <FieldDescription>This team has no one to assign yet. Add employees first.</FieldDescription>
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

function PeopleGroup({ label, people }: { label: string; people: AssigneeOption[] }) {
  if (people.length === 0) return null;
  return (
    <SelectGroup>
      <SelectLabel>{label}</SelectLabel>
      {people.map((m) => (
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
    </SelectGroup>
  );
}
