"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
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
import { deleteTaskAction } from "@/server/actions/lead";

/** For whoever assigned the task: permanently delete it, its subtasks and their history. */
export function DeleteTaskButton({
  taskId,
  title,
  subtaskCount,
  base,
}: {
  taskId: string;
  title: string;
  /** All subtasks, archived ones included: they're deleted too. */
  subtaskCount: number;
  base: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const res = await deleteTaskAction(taskId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setOpen(false);
      toast.success("Task deleted permanently");
      // This page no longer exists: go back to the main task, or the task list.
      router.replace(res.data.parentId ? `${base}/tasks/${res.data.parentId}` : `${base}/tasks`);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)} disabled={pending}>
        <Trash2 />
        Delete
      </Button>

      <AlertDialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              “{title}”
              {subtaskCount > 0 && ` and its ${subtaskCount} subtask${subtaskCount === 1 ? "" : "s"}`} will be removed
              for everyone, together with all history and notes. This can&apos;t be undone. To hide it but keep a
              record, use Archive instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                remove();
              }}
            >
              {pending && <Loader2 className="animate-spin" />}
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
