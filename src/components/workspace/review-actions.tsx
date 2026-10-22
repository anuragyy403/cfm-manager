"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, CircleX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AttachmentPicker } from "@/components/attachments/attachment-picker";
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
import { celebrate } from "@/lib/celebrate";
import { reviewTaskAction } from "@/server/actions/lead";

type Decision = "PASS" | "FAIL";

const COPY: Record<
  Decision,
  { title: string; description: (name: string) => string; label: string; hint: string; placeholder: string; attachHint: string }
> = {
  PASS: {
    title: "Pass this task",
    description: (name) => `It will count as done for ${name}, and they'll get a notification.`,
    label: "Feedback (optional)",
    hint: "Optional. A word of thanks or a note for next time.",
    placeholder: "e.g. Great work, exactly what the client asked for.",
    attachHint: "Optional, e.g. the finished work as the client sees it.",
  },
  FAIL: {
    title: "Fail and send back",
    description: (name) => `${name} will get a notification with your feedback and has to redo it before it can pass.`,
    label: "What needs to change?",
    hint: "Required. Be specific so they can fix it in one go.",
    placeholder: "e.g. The mobile layout breaks below 400px, and the contact form doesn't send.",
    attachHint: "Show what's wrong: a screenshot or a short screen recording.",
  },
};

/** Pass / Fail buttons for the reviewer of handed-in work. */
export function ReviewActions({ taskId, assigneeName }: { taskId: string; assigneeName: string }) {
  const [open, setOpen] = useState<Decision | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [files, setFiles] = useState({ ids: [] as string[], busy: false });
  const first = assigneeName.split(" ")[0] ?? assigneeName;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!open) return;
    const decision = open;
    const note = new FormData(e.currentTarget).get("note");
    startTransition(async () => {
      const res = await reviewTaskAction(taskId, { decision, note, attachmentIds: files.ids });
      if (!res.ok) {
        setError(res.fieldErrors?.note ?? res.error);
        return;
      }
      setError(undefined);
      setOpen(null);
      if (decision === "PASS") {
        void celebrate();
        toast.success(`Passed. It now counts as done for ${first}.`);
      } else {
        toast.success(`Sent back to ${first} with your feedback.`);
      }
    });
  }

  const copy = open ? COPY[open] : null;

  return (
    <>
      <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setOpen("PASS")}>
        <BadgeCheck />
        Pass
      </Button>
      <Button variant="destructive" onClick={() => setOpen("FAIL")}>
        <CircleX />
        Fail
      </Button>

      <Dialog
        open={open !== null}
        onOpenChange={(o) => {
          if (!o) {
            setOpen(null);
            setError(undefined);
          }
        }}
      >
        {copy && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{copy.title}</DialogTitle>
              <DialogDescription>{copy.description(first)}</DialogDescription>
            </DialogHeader>
            <form id="review-form" onSubmit={submit}>
              <Field data-invalid={!!error}>
                <FieldLabel htmlFor="review-note">{copy.label}</FieldLabel>
                <Textarea id="review-note" name="note" rows={4} placeholder={copy.placeholder} autoFocus />
                {error ? <FieldError>{error}</FieldError> : <FieldDescription>{copy.hint}</FieldDescription>}
              </Field>
              <Field className="mt-4">
                <FieldLabel>Photos or videos (optional)</FieldLabel>
                <AttachmentPicker onChange={setFiles} disabled={pending} hint={copy.attachHint} />
              </Field>
            </form>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(null)} disabled={pending}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="review-form"
                disabled={pending || files.busy}
                variant={open === "FAIL" ? "destructive" : "default"}
                className={open === "PASS" ? "bg-emerald-600 text-white hover:bg-emerald-700" : undefined}
              >
                {(pending || files.busy) && <Loader2 className="animate-spin" />}
                {files.busy ? "Uploading…" : open === "PASS" ? "Pass task" : "Fail and send back"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
