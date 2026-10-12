"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, CirclePlay, Loader2 } from "lucide-react";
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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { TaskStatus } from "@/lib/tasks/rules";
import { completeTaskAction, startTaskAction } from "@/server/actions/member";

export function MemberTaskActions({ taskId, status }: { taskId: string; status: TaskStatus }) {
  const [pending, startTransition] = useTransition();
  const [completeOpen, setCompleteOpen] = useState(false);
  const [noteError, setNoteError] = useState<string>();

  if (status === "COMPLETED") return null;

  function start() {
    startTransition(async () => {
      const res = await startTaskAction(taskId);
      if (!res.ok) toast.error(res.error);
      else toast.success("Marked as in progress", { description: "Your manager can see you've started." });
    });
  }

  function complete(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const note = new FormData(e.currentTarget).get("note");
    startTransition(async () => {
      const res = await completeTaskAction(taskId, { note });
      if (!res.ok) {
        setNoteError(res.fieldErrors?.note ?? res.error);
        return;
      }
      setNoteError(undefined);
      setCompleteOpen(false);
      toast.success("Task completed", { description: "Your manager has been updated." });
    });
  }

  return (
    <>
      {status === "PENDING" && (
        <Button variant="outline" onClick={start} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <CirclePlay />}
          Start working
        </Button>
      )}
      <Button onClick={() => setCompleteOpen(true)} disabled={pending}>
        <CheckCircle2 />
        Mark as completed
      </Button>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete this task</DialogTitle>
            <DialogDescription>
              Tell your manager what was done. This can&apos;t be undone from your side.
            </DialogDescription>
          </DialogHeader>
          <form id="complete-form" onSubmit={complete}>
            <Field data-invalid={!!noteError}>
              <FieldLabel htmlFor="note">Completion note</FieldLabel>
              <Textarea
                id="note"
                name="note"
                rows={4}
                placeholder="What did you deliver? Add links to files or pages if relevant."
                autoFocus
              />
              {noteError ? (
                <FieldError>{noteError}</FieldError>
              ) : (
                <FieldDescription>Required. Your manager sees this with the completed task.</FieldDescription>
              )}
            </Field>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" form="complete-form" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Submit &amp; complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
