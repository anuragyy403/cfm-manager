"use client";

import { useState, useTransition } from "react";
import { KeyRound, Loader2 } from "lucide-react";
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
import { sendPasswordResetAction } from "@/server/actions/lead";

/** Lets a lead email a locked-out colleague a link to choose a new password. */
export function SendResetButton({ userId, name, email }: { userId: string; name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      const res = await sendPasswordResetAction(userId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Reset email sent to ${res.data.email}`);
      setOpen(false);
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <KeyRound />
        Send password reset
      </Button>
      <AlertDialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send {name} a password reset email?</AlertDialogTitle>
            <AlertDialogDescription>
              We&apos;ll email <strong>{email}</strong> a link to choose a new password. The link works once and
              expires in 1 hour. Their current password keeps working until they use it, and you never see
              the new password.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                send();
              }}
            >
              {pending && <Loader2 className="animate-spin" />}
              Send email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
