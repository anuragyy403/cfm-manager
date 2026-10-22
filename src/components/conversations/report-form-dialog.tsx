"use client";

import { useState, useTransition } from "react";
import { Check, ChevronsUpDown, Loader2, NotebookPen, X } from "lucide-react";
import { toast } from "sonner";
import { AttachmentPicker } from "@/components/attachments/attachment-picker";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { dayKey } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { sendReportAction } from "@/server/actions/conversations";
import type { PersonOption } from "./raise-case-dialog";

/** HR's daily meeting report to the owner. */
export function ReportFormDialog({ people }: { people: PersonOption[] }) {
  const [open, setOpen] = useState(false);
  const [attendees, setAttendees] = useState<string[]>([]);
  const [files, setFiles] = useState({ ids: [] as string[], busy: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const today = dayKey(new Date());

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await sendReportAction({
        meetingDate: form.get("meetingDate"),
        title: form.get("title"),
        attendeeIds: attendees,
        discussed: form.get("discussed"),
        decisions: form.get("decisions"),
        actionItems: form.get("actionItems"),
        attachmentIds: files.ids,
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        if (!res.fieldErrors) toast.error(res.error);
        return;
      }
      setOpen(false);
      setAttendees([]);
      setErrors({});
      toast.success("Report sent to the owner", { description: "You'll see “Seen” under it once they've read it." });
    });
  }

  return (
    <>
      <Button variant="brand" onClick={() => setOpen(true)}>
        <NotebookPen />
        New meeting report
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Meeting report for the owner</DialogTitle>
            <DialogDescription>Only you and the owner can see it. The owner can reply to it right under it.</DialogDescription>
          </DialogHeader>
          <form
            id="report-form"
            onSubmit={submit}
            // Typing in a field clears its error.
            onChange={(e) => {
              const field = e.target as unknown as { name?: string };
              if (field.name && errors[field.name]) setErrors((all) => withoutKey(all, field.name!));
            }}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
              <Field data-invalid={!!errors.meetingDate}>
                <FieldLabel htmlFor="meetingDate">Date</FieldLabel>
                <Input id="meetingDate" name="meetingDate" type="date" defaultValue={today} max={today} required />
                <FieldError>{errors.meetingDate}</FieldError>
              </Field>
              <Field data-invalid={!!errors.title}>
                <FieldLabel htmlFor="report-title">Meeting</FieldLabel>
                <Input id="report-title" name="title" maxLength={150} placeholder="e.g. Daily stand-up, Hiring review" aria-invalid={!!errors.title} />
                <FieldError>{errors.title}</FieldError>
              </Field>
            </div>
            <Field>
              <FieldLabel>Who attended</FieldLabel>
              <AttendeePicker people={people} value={attendees} onChange={setAttendees} />
            </Field>
            <Field data-invalid={!!errors.discussed}>
              <FieldLabel htmlFor="discussed">What was discussed</FieldLabel>
              <Textarea id="discussed" name="discussed" rows={5} maxLength={8000} placeholder="Main points, one per line." aria-invalid={!!errors.discussed} />
              <FieldError>{errors.discussed}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="decisions">Decisions (optional)</FieldLabel>
              <Textarea id="decisions" name="decisions" rows={3} maxLength={4000} placeholder="What was agreed." />
            </Field>
            <Field>
              <FieldLabel htmlFor="actionItems">Action items (optional)</FieldLabel>
              <Textarea id="actionItems" name="actionItems" rows={3} maxLength={4000} placeholder="Who does what, by when." />
              <FieldDescription>Tip: assign these as tasks too, so they&apos;re tracked.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Photos or videos (optional)</FieldLabel>
              <AttachmentPicker onChange={setFiles} disabled={pending} hint="Whiteboard photos, slides or a recording." />
            </Field>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" form="report-form" variant="brand" disabled={pending || files.busy}>
              {(pending || files.busy) && <Loader2 className="animate-spin" />}
              {files.busy ? "Uploading…" : "Send report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AttendeePicker({
  people,
  value,
  onChange,
}: {
  people: PersonOption[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const chosen = people.filter((p) => value.includes(p.id));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-between font-normal" aria-expanded={open}>
            {value.length ? `${value.length} ${value.length === 1 ? "person" : "people"} chosen` : "Choose people"}
            <ChevronsUpDown className="opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command>
            <CommandInput placeholder="Search people…" />
            <CommandList>
              <CommandEmpty>No one found.</CommandEmpty>
              <CommandGroup>
                {people.map((p) => {
                  const on = value.includes(p.id);
                  return (
                    <CommandItem key={p.id} value={`${p.name} ${p.id}`} onSelect={() => toggle(p.id)}>
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded border",
                          on ? "border-primary bg-primary text-primary-foreground" : "border-input",
                        )}
                      >
                        {on && <Check className="size-3 text-current!" />}
                      </span>
                      <UserAvatar name={p.name} id={p.id} image={p.image} size="xs" />
                      <span className="truncate">{p.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{ROLE_LABELS[p.role]}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {chosen.map((p) => (
            <li key={p.id} className="flex items-center gap-1 rounded-full border bg-muted/40 py-0.5 pr-1 pl-0.5 text-xs">
              <UserAvatar name={p.name} id={p.id} image={p.image} size="xs" className="size-5" />
              {p.name}
              <button
                type="button"
                onClick={() => toggle(p.id)}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Remove ${p.name}`}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function withoutKey(errors: Record<string, string>, key: string) {
  const next = { ...errors };
  delete next[key];
  return next;
}
