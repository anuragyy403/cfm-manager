"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { deleteTeamAction } from "@/server/actions/owner";

/**
 * Owner only: delete a team. Its tasks (and their history) move to another
 * team first, so nobody's work record is lost.
 */
export function DeleteTeamButton({
  teamId,
  name,
  tasks,
  employees,
  otherTeams,
  base,
}: {
  teamId: string;
  name: string;
  /** All tasks given in this team, archived ones included. */
  tasks: number;
  employees: number;
  otherTeams: { id: string; name: string }[];
  base: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [moveTo, setMoveTo] = useState("");
  const [pending, startTransition] = useTransition();
  const needsTarget = tasks > 0;
  const blocked = needsTarget && otherTeams.length === 0;
  const confirmed =
    typed.trim().toLowerCase() === name.trim().toLowerCase() && (!needsTarget || moveTo !== "") && !blocked;

  function remove() {
    startTransition(async () => {
      const res = await deleteTeamAction(teamId, needsTarget ? moveTo : null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setOpen(false);
      const { name: deleted, movedTasks, movedTo } = res.data;
      toast.success(`${deleted} was deleted`, {
        description: movedTasks
          ? `${movedTasks} task${movedTasks === 1 ? "" : "s"} moved to ${movedTo}.`
          : undefined,
      });
      router.replace(`${base}/teams`);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="destructive"
        onClick={() => {
          setTyped("");
          setMoveTo("");
          setOpen(true);
        }}
      >
        <Trash2 />
        Delete team
      </Button>

      <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {name}?</DialogTitle>
            <DialogDescription>The team is removed for everyone. This can&apos;t be undone.</DialogDescription>
          </DialogHeader>

          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>
              {employees === 0
                ? "It has no employees."
                : `Its ${employees} employee${employees === 1 ? "" : "s"} end up without a team; their accounts stay, so you can add them to another team.`}
            </li>
            <li>
              {tasks === 0
                ? "It has no tasks, so no work history is affected."
                : `Its ${tasks} task${tasks === 1 ? "" : "s"} and their history move to the team you choose, so nobody's record is lost. Open ones may need reassigning there.`}
            </li>
          </ul>

          {needsTarget &&
            (blocked ? (
              <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                There&apos;s no other team to move its tasks to. Create another team first.
              </p>
            ) : (
              <Field>
                <FieldLabel htmlFor="move-to">Move its tasks to</FieldLabel>
                <select
                  id="move-to"
                  value={moveTo}
                  onChange={(e) => setMoveTo(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  <option value="">Choose a team…</option>
                  {otherTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
            ))}

          <Field>
            <FieldLabel htmlFor="confirm-team">Type the team name to confirm</FieldLabel>
            <Input
              id="confirm-team"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={name}
              autoComplete="off"
            />
            <FieldDescription>{name}</FieldDescription>
          </Field>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              onClick={remove}
              disabled={pending || !confirmed}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {pending && <Loader2 className="animate-spin" />}
              Delete team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
