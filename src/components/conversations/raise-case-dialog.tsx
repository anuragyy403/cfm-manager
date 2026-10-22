"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Flame, Loader2, Lock, MessageSquarePlus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { CASE_CATEGORIES, CATEGORY_LABELS, type CaseCategory } from "@/lib/conversations";
import { type AppRole, ROLE_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { raiseCaseAction } from "@/server/actions/conversations";

export type PersonOption = { id: string; name: string; image: string | null; role: AppRole };

const NOBODY = "__nobody__";

/** "Raise a concern": a private case only the person raising it and the owner can see. */
export function RaiseCaseDialog({ people, base }: { people: PersonOption[]; base: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<CaseCategory | "">("");
  const [aboutUserId, setAboutUserId] = useState(NOBODY);
  const [urgent, setUrgent] = useState(false);
  const [files, setFiles] = useState({ ids: [] as string[], busy: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function reset() {
    setCategory("");
    setAboutUserId(NOBODY);
    setUrgent(false);
    setErrors({});
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await raiseCaseAction({
        subject: form.get("subject"),
        category: category || undefined,
        urgency: urgent ? "URGENT" : "NORMAL",
        aboutUserId: aboutUserId === NOBODY ? undefined : aboutUserId,
        body: form.get("body"),
        attachmentIds: files.ids,
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        if (!res.fieldErrors) toast.error(res.error);
        return;
      }
      setOpen(false);
      reset();
      toast.success("Sent privately to the owner", { description: "You'll get a notification when they reply." });
      router.push(`${base}/talk/${res.data.id}`);
    });
  }

  return (
    <>
      <Button variant="brand" onClick={() => setOpen(true)}>
        <MessageSquarePlus />
        Raise a concern
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setErrors({});
        }}
      >
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Raise a concern with the owner</DialogTitle>
            <DialogDescription className="flex items-start gap-1.5">
              <Lock className="mt-0.5 size-3.5 shrink-0" />
              Only you and the owner can see this. The person it&apos;s about is never shown it or told about it.
            </DialogDescription>
          </DialogHeader>
          <form
            id="raise-case-form"
            onSubmit={submit}
            // Typing in a field clears its error.
            onChange={(e) => {
              const field = e.target as unknown as { name?: string };
              if (field.name && errors[field.name]) setErrors((all) => withoutKey(all, field.name!));
            }}
            className="space-y-4"
          >
            <Field data-invalid={!!errors.category}>
              <FieldLabel htmlFor="case-category">What is it about?</FieldLabel>
              <Select
                value={category}
                onValueChange={(v) => {
                  setCategory(v as CaseCategory);
                  setErrors((all) => withoutKey(all, "category"));
                }}
              >
                <SelectTrigger id="case-category" className="w-full" aria-invalid={!!errors.category}>
                  <SelectValue placeholder="Choose one" />
                </SelectTrigger>
                <SelectContent>
                  {CASE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError>{errors.category}</FieldError>
            </Field>
            <Field data-invalid={!!errors.subject}>
              <FieldLabel htmlFor="case-subject">Short title</FieldLabel>
              <Input id="case-subject" name="subject" maxLength={120} placeholder="e.g. Credit for my work in team meetings" aria-invalid={!!errors.subject} />
              <FieldError>{errors.subject}</FieldError>
            </Field>
            <Field data-invalid={!!errors.aboutUserId}>
              <FieldLabel htmlFor="case-about">Who is it about? (optional)</FieldLabel>
              <Select value={aboutUserId} onValueChange={setAboutUserId}>
                <SelectTrigger id="case-about" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NOBODY}>No one in particular</SelectItem>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex min-w-0 items-center gap-2">
                        <UserAvatar name={p.name} id={p.id} image={p.image} size="xs" />
                        <span className="truncate">{p.name}</span>
                        <span className="text-xs text-muted-foreground">{ROLE_LABELS[p.role]}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.aboutUserId ? (
                <FieldError>{errors.aboutUserId}</FieldError>
              ) : (
                <FieldDescription>They won&apos;t be notified or able to see it.</FieldDescription>
              )}
            </Field>
            <Field data-invalid={!!errors.body}>
              <FieldLabel htmlFor="case-body">What happened?</FieldLabel>
              <Textarea
                id="case-body"
                name="body"
                rows={6}
                maxLength={5000}
                placeholder="Describe what happened, when, and who was involved. Facts help the owner act on it."
                aria-invalid={!!errors.body}
              />
              <FieldError>{errors.body}</FieldError>
            </Field>
            <Field>
              <FieldLabel>Photos or videos (optional)</FieldLabel>
              <AttachmentPicker onChange={setFiles} disabled={pending} hint="Screenshots of chats, photos or a short video." />
            </Field>
            <button
              type="button"
              role="switch"
              aria-checked={urgent}
              onClick={() => setUrgent((u) => !u)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition-colors",
                urgent ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40" : "hover:bg-muted/60",
              )}
            >
              <Flame className={cn("size-5 shrink-0", urgent ? "text-red-600" : "text-muted-foreground")} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">This is urgent</span>
                <span className="block text-xs text-muted-foreground">It goes to the top of the owner&apos;s inbox.</span>
              </span>
              <span
                className={cn(
                  "flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
                  urgent ? "justify-end bg-red-600" : "bg-muted-foreground/30",
                )}
              >
                <span className="size-4 rounded-full bg-white shadow-sm" />
              </span>
            </button>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" form="raise-case-form" variant="brand" disabled={pending || files.busy}>
              {(pending || files.busy) && <Loader2 className="animate-spin" />}
              {files.busy ? "Uploading…" : "Send to the owner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function withoutKey(errors: Record<string, string>, key: string) {
  const next = { ...errors };
  delete next[key];
  return next;
}
