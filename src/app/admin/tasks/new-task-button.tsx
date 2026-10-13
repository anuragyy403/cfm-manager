"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type MemberOption, TaskFormDialog } from "./task-form-dialog";

export function NewTaskButton({
  members,
  defaultAssigneeId,
  label = "New task",
  variant = "brand",
}: {
  members: MemberOption[];
  defaultAssigneeId?: string;
  label?: string;
  variant?: "brand" | "outline" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  // Remount the form each time it opens so it starts empty.
  const [formKey, setFormKey] = useState(0);

  if (members.length === 0) {
    return (
      <Button asChild variant="secondary">
        <Link href="/admin/team">
          <UserPlus />
          Add team members first
        </Link>
      </Button>
    );
  }

  return (
    <>
      <Button
        variant={variant}
        onClick={() => {
          setFormKey((k) => k + 1);
          setOpen(true);
        }}
      >
        <Plus />
        {label}
      </Button>
      <TaskFormDialog
        key={formKey}
        open={open}
        onOpenChange={setOpen}
        members={members}
        defaultAssigneeId={defaultAssigneeId}
      />
    </>
  );
}
