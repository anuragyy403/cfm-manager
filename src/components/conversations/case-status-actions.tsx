"use client";

import { useTransition } from "react";
import { CircleCheck, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { CaseStatus } from "@/lib/conversations";
import { setCaseStatusAction } from "@/server/actions/conversations";

/** The owner's buttons on a case: mark it resolved, or reopen it. */
export function CaseStatusActions({ conversationId, status, raiserName }: { conversationId: string; status: CaseStatus; raiserName: string }) {
  const [pending, startTransition] = useTransition();
  if (status === "WITHDRAWN") return null;
  const first = raiserName.split(" ")[0] ?? raiserName;

  function set(next: "IN_DISCUSSION" | "RESOLVED") {
    startTransition(async () => {
      const res = await setCaseStatusAction(conversationId, next);
      if (!res.ok) toast.error(res.error);
      else toast.success(next === "RESOLVED" ? `Marked resolved. ${first} has been notified.` : `Reopened. ${first} has been notified.`);
    });
  }

  return status === "RESOLVED" ? (
    <Button variant="outline" onClick={() => set("IN_DISCUSSION")} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
      Reopen
    </Button>
  ) : (
    <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => set("RESOLVED")} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <CircleCheck />}
      Mark resolved
    </Button>
  );
}
