"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CornerDownRight, Loader2, Users } from "lucide-react";
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
import { createTaskAction, createTeamTaskAction, updateTaskAction } from "@/server/actions/lead";

export type AssigneeOption = {
  id: string;
  name: string;
  username: string | null;
  /** Open (not completed) tasks already assigned; shown as a workload hint. */
  openTasks?: number;
  isManager?: boolean;
  /** HR's work needs no team; the server files it under HR. */
  isHR?: boolean;
};

export type TeamOption = { id: string; name: string; people: AssigneeOption[] };

/** "Assign to" value prefix meaning every employee on that team gets their own copy. */
const WHOLE_TEAM = "__team__:";

/** Someone a new task can go to, with the teams they can get it in (none for HR). */
type Candidate = { person: AssigneeOption; teams: { id: string; name: string }[] };

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
  hr = [],
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
  /** Preferred team when the chosen person heads several. */
  defaultTeamId?: string;
  /** Everyone in HR (owner only). They're picked directly, with no team. */
  hr?: AssigneeOption[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? defaultAssigneeId ?? "");
  const [teamChoice, setTeamChoice] = useState(defaultTeamId ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "MEDIUM");

  const editing = !!task;
  // Edits and subtasks stay in their task's team; a new task starts from the person.
  const lockedTeamId = task?.teamId ?? parent?.teamId;
  const lockedPeople = lockedTeamId ? (teams.find((t) => t.id === lockedTeamId)?.people ?? []) : [];

  const candidates = useMemo(() => {
    const byId = new Map<string, Candidate>();
    for (const p of hr) byId.set(p.id, { person: { ...p, isHR: true }, teams: [] });
    for (const t of teams) {
      for (const p of t.people) {
        // HR is never tied to a team, even when they head the HR team.
        if (p.isHR) {
          if (!byId.has(p.id)) byId.set(p.id, { person: p, teams: [] });
          continue;
        }
        const c = byId.get(p.id) ?? { person: p, teams: [] };
        c.teams.push({ id: t.id, name: t.name });
        byId.set(p.id, c);
      }
    }
    return [...byId.values()].sort((a, b) => a.person.name.localeCompare(b.person.name));
  }, [teams, hr]);

  const wholeTeamId = !lockedTeamId && assigneeId.startsWith(WHOLE_TEAM) ? assigneeId.slice(WHOLE_TEAM.length) : null;
  const chosen = lockedTeamId || wholeTeamId ? undefined : candidates.find((c) => c.person.id === assigneeId);
  const chosenIsHR = !!chosen?.person.isHR;
  // Only someone who heads more than one team needs to say which one.
  const pickTeam = !!chosen && !chosenIsHR && chosen.teams.length > 1;
  const teamId =
    lockedTeamId ??
    wholeTeamId ??
    (!chosen || chosenIsHR
      ? ""
      : chosen.teams.length === 1
        ? chosen.teams[0]!.id
        : chosen.teams.some((t) => t.id === teamChoice)
          ? teamChoice
          : "");
  const wholeTeams = lockedTeamId
    ? []
    : teams
        .map((t) => ({ id: t.id, name: t.name, employees: t.people.filter((p) => !p.isManager).length }))
        .filter((t) => t.employees > 0);
  const minDue = format(new Date(), "yyyy-MM-dd'T'HH:mm");

  function clearError(...keys: string[]) {
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !keys.includes(k))));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const dueLocal = String(form.get("dueAt") ?? "");
    const due = dueLocal ? new Date(dueLocal) : null;

    if (pickTeam && !teamId) {
      setErrors({ teamId: "Choose which team this task is for." });
      return;
    }

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
    if (wholeTeamId) {
      // The schema drops the "whole team" assignee marker.
      const res = await createTeamTaskAction(input);
      setPending(false);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      setErrors({});
      onOpenChange(false);
      toast.success(`Task assigned to ${res.data.count} ${res.data.count === 1 ? "person" : "people"}`, {
        description: "Everyone on the team got their own copy to work on and hand in.",
      });
      router.push(`${base}/tasks?team=${wholeTeamId}`);
      return;
    }
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
      const who = (chosen?.person ?? lockedPeople.find((m) => m.id === assigneeId))?.name ?? "They";
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
            <Field data-invalid={!!errors.assigneeId}>
              <FieldLabel htmlFor="assignee">Assign to</FieldLabel>
              <Select
                value={assigneeId}
                onValueChange={(v) => {
                  setAssigneeId(v);
                  clearError("assigneeId", "teamId");
                }}
                disabled={task?.completed}
              >
                <SelectTrigger id="assignee" className="w-full" aria-invalid={!!errors.assigneeId}>
                  <SelectValue placeholder="Choose a person" />
                </SelectTrigger>
                <SelectContent>
                  {lockedTeamId ? (
                    <>
                      <PeopleGroup label="HR" people={lockedPeople.filter((p) => p.isHR)} />
                      <PeopleGroup label="Manager" people={lockedPeople.filter((p) => p.isManager && !p.isHR)} />
                      <PeopleGroup label="Employees" people={lockedPeople.filter((p) => !p.isManager)} />
                    </>
                  ) : (
                    <>
                      {wholeTeams.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Whole team</SelectLabel>
                          {wholeTeams.map((t) => (
                            <SelectItem key={t.id} value={`${WHOLE_TEAM}${t.id}`}>
                              <span className="flex w-full min-w-0 items-center gap-2">
                                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-navy text-white">
                                  <Users className="size-3.5 text-white!" />
                                </span>
                                <span className="truncate font-medium">Everyone on {t.name}</span>
                                <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
                                  {t.employees} {t.employees === 1 ? "person" : "people"}
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      <PeopleGroup label="HR" people={candidates.filter((c) => c.person.isHR).map((c) => c.person)} />
                      <PeopleGroup
                        label="Managers"
                        people={candidates.filter((c) => c.person.isManager && !c.person.isHR).map((c) => c.person)}
                        hint={(p) => teamNames(candidates, p.id)}
                      />
                      <PeopleGroup
                        label="Employees"
                        people={candidates.filter((c) => !c.person.isManager).map((c) => c.person)}
                        hint={(p) => teamNames(candidates, p.id)}
                      />
                    </>
                  )}
                </SelectContent>
              </Select>
              {errors.assigneeId ? (
                <FieldError>{errors.assigneeId}</FieldError>
              ) : task?.completed ? (
                <FieldDescription>Reopen the task to reassign it.</FieldDescription>
              ) : editing ? (
                <FieldDescription>Reassigning resets progress to pending.</FieldDescription>
              ) : wholeTeamId ? (
                <FieldDescription>Each employee gets their own copy to do and hand in.</FieldDescription>
              ) : chosenIsHR ? (
                <FieldDescription>HR isn&apos;t on a team, so there&apos;s no team to choose.</FieldDescription>
              ) : chosen && !pickTeam ? (
                <FieldDescription>Goes to {chosen.teams[0]?.name}.</FieldDescription>
              ) : lockedTeamId && lockedPeople.length === 0 ? (
                <FieldDescription>This team has no one else to assign yet. Add employees first.</FieldDescription>
              ) : null}
            </Field>
            {pickTeam && (
              <Field data-invalid={!!errors.teamId}>
                <FieldLabel htmlFor="team">Team</FieldLabel>
                <Select
                  value={teamId}
                  onValueChange={(v) => {
                    setTeamChoice(v);
                    clearError("teamId");
                  }}
                >
                  <SelectTrigger id="team" className="w-full" aria-invalid={!!errors.teamId}>
                    <SelectValue placeholder={`Which of ${chosen.person.name.split(" ")[0]}'s teams?`} />
                  </SelectTrigger>
                  <SelectContent>
                    {chosen.teams.map((t) => (
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
            </div>
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

/** The teams someone can be given work in, shown next to their name. */
function teamNames(candidates: Candidate[], id: string) {
  return candidates.find((c) => c.person.id === id)?.teams.map((t) => t.name).join(", ") ?? "";
}

function PeopleGroup({
  label,
  people,
  hint,
}: {
  label: string;
  people: AssigneeOption[];
  hint?: (p: AssigneeOption) => string;
}) {
  if (people.length === 0) return null;
  return (
    <SelectGroup>
      <SelectLabel>{label}</SelectLabel>
      {people.map((m) => {
        const note = hint?.(m);
        return (
          <SelectItem key={m.id} value={m.id}>
            <span className="flex w-full min-w-0 items-center gap-2">
              <UserAvatar name={m.name} id={m.id} size="xs" />
              <span className="truncate">{m.name}</span>
              {note && <span className="truncate text-xs text-muted-foreground">{note}</span>}
              {m.openTasks !== undefined && (
                <span
                  className={cn(
                    "ml-auto shrink-0 rounded-full px-1.5 text-[11px] tabular-nums",
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
        );
      })}
    </SelectGroup>
  );
}
