"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, UserX } from "lucide-react";
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
import { deleteEmployeeAction } from "@/server/actions/owner";

/** Owner only: delete the account of an employee who has left, with their tasks. */
export function DeleteEmployeeButton({
  userId,
  name,
  tasks,
  open: openTasks,
  base,
}: {
  userId: string;
  name: string;
  /** All tasks assigned to them, archived ones included. */
  tasks: number;
  /** Tasks not yet passed. */
  open: number;
  base: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();
  const confirmed = typed.trim().toLowerCase() === name.trim().toLowerCase();

  function remove() {
    startTransition(async () => {
      const res = await deleteEmployeeAction(userId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setOpen(false);
      toast.success(`${res.data.name}'s account was deleted`);
      router.replace(`${base}/people`);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="destructive"
        onClick={() => {
          setTyped("");
          setOpen(true);
        }}
      >
        <UserX />
        Delete account
      </Button>

      <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {name}&apos;s account?</DialogTitle>
            <DialogDescription>For someone who has left the company. This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>They&apos;re signed out everywhere and can&apos;t sign in again.</li>
            <li>
              {tasks === 0 ? (
                "They have no tasks, so no work history is lost."
              ) : (
                <>
                  <strong className="text-foreground">
                    {tasks} task{tasks === 1 ? "" : "s"} and their history
                  </strong>{" "}
                  are deleted and drop out of analytics.
                </>
              )}
            </li>
            {openTasks > 0 && (
              <li>
                <strong className="text-foreground">{openTasks} still open.</strong> To keep that work, reassign it to
                someone else first.
              </li>
            )}
            <li>Subtasks other people did under their tasks are kept.</li>
          </ul>
          <Field>
            <FieldLabel htmlFor="confirm-name">Type their name to confirm</FieldLabel>
            <Input
              id="confirm-name"
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
              Delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
