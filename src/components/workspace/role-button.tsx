"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, UserCog } from "lucide-react";
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
import { ROLE_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { setRoleAction } from "@/server/actions/owner";

type ChangeableRole = "HR" | "MANAGER" | "MEMBER";

const OPTIONS: { role: ChangeableRole; description: string }[] = [
  { role: "MEMBER", description: "Sees only the tasks assigned to them. Can be on one team." },
  { role: "MANAGER", description: "Runs their own teams: adds employees, assigns and reviews their work." },
  {
    role: "HR",
    description:
      "Works across every team: assigns, manages and reviews any team's tasks. Gets work from you through the HR team.",
  },
];

/** Owner only: make someone an employee, a manager or HR. */
export function RoleButton({
  userId,
  name,
  role,
  teamName,
  size = "default",
}: {
  userId: string;
  name: string;
  role: ChangeableRole;
  /** The employee's current team, mentioned when they become a lead. */
  teamName?: string | null;
  size?: "default" | "sm";
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<ChangeableRole>(role);
  const [pending, startTransition] = useTransition();

  function save() {
    if (choice === role) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const res = await setRoleAction(userId, choice);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${name} is now ${choice === "MEMBER" ? "an employee" : choice === "HR" ? "HR" : "a manager"}`);
      setOpen(false);
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size={size}
        onClick={() => {
          setChoice(role);
          setOpen(true);
        }}
      >
        <UserCog />
        Change role
      </Button>
      <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change {name}&apos;s role</DialogTitle>
            <DialogDescription>
              Their tasks and history stay as they are.
              {choice !== "MEMBER" && role === "MEMBER" && teamName && (
                <>
                  {" "}
                  {name} leaves <strong>{teamName}</strong> as an employee.
                </>
              )}
              {choice === "MEMBER" && role !== "MEMBER" && " Anyone heading a team needs to hand it over first."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2" role="radiogroup" aria-label="Role">
            {OPTIONS.map((o) => {
              const selected = choice === o.role;
              return (
                <button
                  key={o.role}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setChoice(o.role)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                    selected ? "border-brand-navy bg-brand-navy/5 dark:border-white/40" : "hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                      selected && "border-brand-navy bg-brand-navy text-white dark:border-white dark:bg-white dark:text-black",
                    )}
                  >
                    {selected && <Check className="size-3" />}
                  </span>
                  <span className="grid gap-0.5">
                    <span className="text-sm font-medium">
                      {ROLE_LABELS[o.role]}
                      {o.role === role && <span className="font-normal text-muted-foreground"> (current)</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">{o.description}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending || choice === role}>
              {pending && <Loader2 className="animate-spin" />}
              Save role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
