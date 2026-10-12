"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type MemberOption, TaskFormDialog } from "./task-form-dialog";

export function NewTaskButton({ members }: { members: MemberOption[] }) {
  const [open, setOpen] = useState(false);
  // Remount the form each time it opens so it starts empty.
  const [formKey, setFormKey] = useState(0);

  if (members.length === 0) {
    return (
      <Button asChild variant="outline">
        <Link href="/admin/team">Add team members to assign tasks</Link>
      </Button>
    );
  }

  return (
    <>
      <Button
        onClick={() => {
          setFormKey((k) => k + 1);
          setOpen(true);
        }}
      >
        <Plus />
        New task
      </Button>
      <TaskFormDialog key={formKey} open={open} onOpenChange={setOpen} members={members} />
    </>
  );
}
