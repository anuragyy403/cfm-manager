"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import { createTeamAction, updateTeamAction } from "@/server/actions/lead";

export type ManagerCandidate = { id: string; name: string; role: AppRole };

export function TeamForm({
  team,
  base,
  managers,
  onDone,
}: {
  /** When set the form edits this team; otherwise it creates one. */
  team?: { id: string; name: string; description: string | null };
  base: string;
  /** Owner only: who can run a new team. Managers always run the teams they create. */
  managers?: ManagerCandidate[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [managerId, setManagerId] = useState(
    managers?.find((m) => m.role === "MANAGER")?.id ?? managers?.[0]?.id ?? "",
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const input = {
      name: form.get("name"),
      description: form.get("description"),
      ...(managers && !team ? { managerId } : {}),
    };
    setPending(true);
    const res = team ? await updateTeamAction(team.id, input) : await createTeamAction(input);
    setPending(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    setErrors({});
    toast.success(team ? "Team updated" : "Team created");
    onDone?.();
    if (!team && "data" in res && res.data) router.push(`${base}/teams/${(res.data as { id: string }).id}`);
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="team-name">Team name</FieldLabel>
          <Input id="team-name" name="name" defaultValue={team?.name} placeholder="e.g. Tech team" autoFocus />
          <FieldError>{errors.name}</FieldError>
        </Field>
        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="team-description">Description (optional)</FieldLabel>
          <Textarea
            id="team-description"
            name="description"
            defaultValue={team?.description ?? ""}
            placeholder="What does this team work on?"
            rows={3}
          />
          <FieldError>{errors.description}</FieldError>
        </Field>
        {managers && !team && (
          <Field data-invalid={!!errors.managerId}>
            <FieldLabel htmlFor="team-manager">Manager</FieldLabel>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger id="team-manager" className="w-full">
                <SelectValue placeholder="Choose who runs this team" />
              </SelectTrigger>
              <SelectContent>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                    <span className="text-muted-foreground">
                      {" "}
                      · {m.role === "ADMIN" ? "you" : ROLE_LABELS[m.role].toLowerCase()}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              To make an employee the manager, promote them from the People page or from their team.
            </FieldDescription>
            <FieldError>{errors.managerId}</FieldError>
          </Field>
        )}
        <Button type="submit" disabled={pending} className="w-fit">
          {pending && <Loader2 className="animate-spin" />}
          {team ? "Save changes" : "Create team"}
        </Button>
      </FieldGroup>
    </form>
  );
}
