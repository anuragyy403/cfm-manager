"use client";

import { useState, useTransition } from "react";
import { ArrowDownCircle, ArrowUpCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { setRoleAction } from "@/server/actions/owner";

/** Owner only: promote an employee to manager, or make a manager an employee again. */
export function RoleButton({
  userId,
  name,
  role,
  teamName,
  size = "default",
}: {
  userId: string;
  name: string;
  role: "MANAGER" | "MEMBER";
  /** The employee's current team, mentioned when promoting. */
  teamName?: string | null;
  size?: "default" | "sm";
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const promote = role === "MEMBER";

  function save() {
    startTransition(async () => {
      const res = await setRoleAction(userId, promote ? "MANAGER" : "MEMBER");
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(promote ? `${name} is now a manager` : `${name} is now an employee`);
      setOpen(false);
    });
  }

  return (
    <>
      <Button variant="outline" size={size} onClick={() => setOpen(true)}>
        {promote ? <ArrowUpCircle /> : <ArrowDownCircle />}
        {promote ? "Make manager" : "Make employee"}
      </Button>
      <AlertDialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{promote ? `Make ${name} a manager?` : `Make ${name} an employee?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {promote ? (
                <>
                  Managers get their own workspace where they create teams, add employees and assign work.
                  {teamName && (
                    <>
                      {" "}
                      {name} leaves <strong>{teamName}</strong> as an employee; to have them run it, use{" "}
                      <strong>Change manager</strong> on that team instead.
                    </>
                  )}{" "}
                  Their tasks and history stay as they are.
                </>
              ) : (
                <>
                  {name} goes back to seeing only their own tasks. Anyone still running a team needs a new
                  manager for it first. Afterwards, add them to a team as an employee.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                save();
              }}
            >
              {pending && <Loader2 className="animate-spin" />}
              {promote ? "Make manager" : "Make employee"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
