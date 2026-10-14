"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Plus, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setTeamManagerAction } from "@/server/actions/owner";
import { type ManagerCandidate, TeamForm } from "./team-form";

export function NewTeamButton({
  base,
  managers,
  variant = "brand",
}: {
  base: string;
  managers?: ManagerCandidate[];
  variant?: "brand" | "outline";
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant}>
          <Plus />
          New team
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New team</DialogTitle>
          <DialogDescription>
            {managers
              ? "Name the team and choose who manages it. You can change the manager any time."
              : "You'll manage this team. Add your employees once it's created."}
          </DialogDescription>
        </DialogHeader>
        <TeamForm base={base} managers={managers} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function EditTeamDialog({
  team,
  base,
}: {
  team: { id: string; name: string; description: string | null };
  base: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Pencil />
          Edit team
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit team</DialogTitle>
          <DialogDescription>Update the team&apos;s name and description.</DialogDescription>
        </DialogHeader>
        <TeamForm team={team} base={base} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Owner only: hand a team to another manager, run it yourself, or promote one
 * of its employees to be its manager.
 */
export function ChangeManagerDialog({
  teamId,
  currentManagerId,
  managers,
  employees,
}: {
  teamId: string;
  currentManagerId: string;
  managers: ManagerCandidate[];
  employees: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState(currentManagerId);
  const [pending, startTransition] = useTransition();
  const promoting = employees.some((e) => e.id === choice);

  function save() {
    startTransition(async () => {
      const res = await setTeamManagerAction(teamId, choice);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(promoting ? "Promoted to manager" : "Manager changed");
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setChoice(currentManagerId);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserCog />
          Change manager
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change manager</DialogTitle>
          <DialogDescription>
            The manager sees all of this team&apos;s work, assigns tasks and splits them into subtasks.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="manager-choice">Manager</FieldLabel>
          <Select value={choice} onValueChange={setChoice}>
            <SelectTrigger id="manager-choice" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Managers</SelectLabel>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.role === "ADMIN" ? `${m.name} (you)` : m.name}
                  </SelectItem>
                ))}
              </SelectGroup>
              {employees.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Promote someone on this team</SelectLabel>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
          {promoting && (
            <FieldDescription>
              They become a manager and leave the employee list. Their tasks and history stay as they are.
            </FieldDescription>
          )}
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || choice === currentManagerId}>
            {pending && <Loader2 className="animate-spin" />}
            {promoting ? "Promote & assign" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
