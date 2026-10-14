"use client";

import Link from "next/link";
import { useState } from "react";
import { ListTree, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskFormDialog, type TeamOption } from "./task-form-dialog";

export function NewTaskButton({
  teams,
  base,
  parent,
  defaultAssigneeId,
  defaultTeamId,
  label,
  variant = "brand",
}: {
  teams: TeamOption[];
  base: string;
  /** Creates a subtask of this task instead of a new task. */
  parent?: { id: string; title: string; teamId: string };
  defaultAssigneeId?: string;
  defaultTeamId?: string;
  label?: string;
  variant?: "brand" | "outline" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  // Remount the form each time it opens so it starts empty.
  const [formKey, setFormKey] = useState(0);

  if (!teams.some((t) => t.people.length > 0)) {
    return (
      <Button asChild variant="secondary">
        <Link href={`${base}/teams`}>
          <UserPlus />
          {teams.length === 0 ? "Create a team first" : "Add people to a team first"}
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
        {parent ? <ListTree /> : <Plus />}
        {label ?? (parent ? "Add subtask" : "New task")}
      </Button>
      <TaskFormDialog
        key={formKey}
        open={open}
        onOpenChange={setOpen}
        teams={teams}
        base={base}
        parent={parent}
        defaultAssigneeId={defaultAssigneeId}
        defaultTeamId={defaultTeamId}
      />
    </>
  );
}
