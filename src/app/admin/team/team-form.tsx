"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createTeamAction, updateTeamAction } from "@/server/actions/admin";

export function TeamForm({
  initial,
  onDone,
}: {
  initial?: { name: string; description: string | null };
  onDone?: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const input = { name: form.get("name"), description: form.get("description") };
    setPending(true);
    const res = initial ? await updateTeamAction(input) : await createTeamAction(input);
    setPending(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    setErrors({});
    toast.success(initial ? "Team updated" : "Team created");
    onDone?.();
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="team-name">Team name</FieldLabel>
          <Input id="team-name" name="name" defaultValue={initial?.name} placeholder="e.g. CFM Core Team" autoFocus />
          <FieldError>{errors.name}</FieldError>
        </Field>
        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="team-description">Description (optional)</FieldLabel>
          <Textarea
            id="team-description"
            name="description"
            defaultValue={initial?.description ?? ""}
            placeholder="What does this team work on?"
            rows={3}
          />
          <FieldError>{errors.description}</FieldError>
        </Field>
        <Button type="submit" disabled={pending} className="w-fit">
          {pending && <Loader2 className="animate-spin" />}
          {initial ? "Save changes" : "Create team"}
        </Button>
      </FieldGroup>
    </form>
  );
}
