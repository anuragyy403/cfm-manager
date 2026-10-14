"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, Loader2, Pencil, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { reopenTaskAction, setTaskArchivedAction } from "@/server/actions/lead";
import { type EditableTask, TaskFormDialog, type TeamOption } from "./task-form-dialog";

/** Edit / reassign, reopen and archive, for leads allowed to change the task. */
export function TaskManageActions({
  task,
  teams,
  base,
  archived,
  subtaskCount = 0,
}: {
  task: EditableTask;
  /** The task's own team (reassigning stays within it). */
  teams: TeamOption[];
  base: string;
  archived: boolean;
  /** Open subtasks that would be archived along with this task. */
  subtaskCount?: number;
}) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editKey, setEditKey] = useState(0);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenError, setReopenError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function toggleArchive() {
    startTransition(async () => {
      const res = await setTaskArchivedAction(task.id, !archived);
      if (!res.ok) toast.error(res.error);
      else {
        setArchiveOpen(false);
        toast.success(archived ? "Task restored" : "Task archived");
      }
    });
  }

  function reopen(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const reason = new FormData(e.currentTarget).get("reason");
    startTransition(async () => {
      const res = await reopenTaskAction(task.id, { reason });
      if (!res.ok) {
        setReopenError(res.fieldErrors?.reason ?? res.error);
        return;
      }
      setReopenError(undefined);
      setReopenOpen(false);
      toast.success("Task reopened", { description: "The assignee will see it in their open tasks again." });
    });
  }

  return (
    <>
      {!archived && (
        <Button
          variant="outline"
          onClick={() => {
            setEditKey((k) => k + 1);
            setEditOpen(true);
          }}
        >
          <Pencil />
          Edit / reassign
        </Button>
      )}
      {!archived && task.completed && (
        <Button variant="outline" onClick={() => setReopenOpen(true)}>
          <RotateCcw />
          Reopen
        </Button>
      )}
      <Button
        variant="outline"
        onClick={() => (!archived && subtaskCount > 0 ? setArchiveOpen(true) : toggleArchive())}
        disabled={pending}
      >
        {pending ? <Loader2 className="animate-spin" /> : archived ? <ArchiveRestore /> : <Archive />}
        {archived ? "Restore" : "Archive"}
      </Button>

      <TaskFormDialog key={editKey} open={editOpen} onOpenChange={setEditOpen} teams={teams} base={base} task={task} />

      <AlertDialog open={archiveOpen} onOpenChange={(v) => !pending && setArchiveOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this task and its subtasks?</AlertDialogTitle>
            <AlertDialogDescription>
              Its {subtaskCount} open subtask{subtaskCount === 1 ? "" : "s"} will be archived too and disappear from
              everyone&apos;s dashboards. You can restore them one by one later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                toggleArchive();
              }}
            >
              {pending && <Loader2 className="animate-spin" />}
              Archive all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen this task?</DialogTitle>
            <DialogDescription>
              It moves back to the assignee&apos;s open tasks. The previous completion is kept in the history.
            </DialogDescription>
          </DialogHeader>
          <form id="reopen-form" onSubmit={reopen}>
            <Field data-invalid={!!reopenError}>
              <FieldLabel htmlFor="reason">Reason</FieldLabel>
              <Textarea id="reason" name="reason" rows={3} placeholder="What still needs to be done?" autoFocus />
              <FieldError>{reopenError}</FieldError>
            </Field>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" form="reopen-form" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Reopen task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
