"use client";

import { useState, useTransition } from "react";
import { ImageOff, Loader2 } from "lucide-react";
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
import { removePhotoAction } from "@/server/actions/account";

/** Owner only: take down someone's profile photo (e.g. an unsuitable one). */
export function RemovePhotoButton({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const res = await removePhotoAction(userId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setOpen(false);
      toast.success(`${res.data.name}'s photo was removed`);
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={pending}>
        <ImageOff />
        Remove photo
      </Button>
      <AlertDialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {name}&apos;s photo?</AlertDialogTitle>
            <AlertDialogDescription>
              Their initials show instead. They can upload a new photo from their account settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                remove();
              }}
            >
              {pending && <Loader2 className="animate-spin" />}
              Remove photo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
