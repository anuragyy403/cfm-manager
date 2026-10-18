"use client";

import { useState, useTransition } from "react";
import { CirclePlay, Loader2, SendHorizontal } from "lucide-react";
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
import { startTaskAction, submitTaskAction } from "@/server/actions/work";

/**
 * Start / submit-for-review buttons for the person a task is assigned to.
 * The work only counts as done once the reviewer passes it.
 */
export function WorkActions({
  taskId,
  status,
  reviewer,
  resubmit = false,
}: {
  taskId: string;
  status: TaskStatus;
  /** Who reviews the work, e.g. "Rahul Khanna" or "the owner". */
  reviewer: string;
  /** The reviewer sent it back, so this is another try. */
  resubmit?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [noteError, setNoteError] = useState<string>();

  if (status === "COMPLETED" || status === "SUBMITTED") return null;

  function start() {
    startTransition(async () => {
      const res = await startTaskAction(taskId);
      if (!res.ok) toast.error(res.error);
      else toast.success("Marked as in progress", { description: `${capitalise(reviewer)} can see you've started.` });
    });
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const note = new FormData(e.currentTarget).get("note");
    startTransition(async () => {
      const res = await submitTaskAction(taskId, { note });
      if (!res.ok) {
        setNoteError(res.fieldErrors?.note ?? res.error);
        return;
      }
      setNoteError(undefined);
      setSubmitOpen(false);
      toast.success("Submitted for review", {
        description: `${capitalise(reviewer)} has been notified and will pass it or send it back.`,
      });
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
      <Button variant="brand" onClick={() => setSubmitOpen(true)} disabled={pending}>
        <SendHorizontal />
        {resubmit ? "Resubmit for review" : "Submit for review"}
      </Button>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{resubmit ? "Resubmit for review" : "Submit for review"}</DialogTitle>
            <DialogDescription>
              {capitalise(reviewer)} will check your work and pass it or send it back with feedback. It counts as
              done once it passes.
            </DialogDescription>
          </DialogHeader>
          <form id="submit-form" onSubmit={submit}>
            <Field data-invalid={!!noteError}>
              <FieldLabel htmlFor="note">What did you deliver?</FieldLabel>
              <Textarea
                id="note"
                name="note"
                rows={4}
                placeholder={
                  resubmit
                    ? "What did you change? Add links to files or pages if relevant."
                    : "What did you deliver? Add links to files or pages if relevant."
                }
                autoFocus
              />
              {noteError ? (
                <FieldError>{noteError}</FieldError>
              ) : (
                <FieldDescription>Required. {capitalise(reviewer)} reads this while reviewing.</FieldDescription>
              )}
            </Field>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" form="submit-form" disabled={pending} variant="brand">
              {pending && <Loader2 className="animate-spin" />}
              Submit for review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
