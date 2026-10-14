"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { MoreHorizontal, UserMinus, UserRound } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { removeMemberAction } from "@/server/actions/lead";

export function MemberActions({
  teamId,
  userId,
  name,
  openTasks,
  base,
}: {
  teamId: string;
  userId: string;
  name: string;
  openTasks: number;
  base: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const res = await removeMemberAction(teamId, userId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${name} removed from the team`);
      setConfirming(false);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`${base}/people/${userId}`}>
              <UserRound />
              View profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
            <UserMinus />
            Remove from team
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {name} from the team?</AlertDialogTitle>
            <AlertDialogDescription>
              Their task history is kept for reporting, but they will no longer see this team&apos;s tasks.
              {openTasks > 0 && (
                <>
                  {" "}
                  They still have <strong>{openTasks} open task{openTasks === 1 ? "" : "s"}</strong>; reassign
                  {openTasks === 1 ? " it" : " them"} to someone else afterwards.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                remove();
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
