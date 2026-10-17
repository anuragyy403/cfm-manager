"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Bell, Loader2, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AppRole } from "@/lib/roles";
import { usePush } from "./pwa";

const DISMISSED_KEY = "cfm-push-banner-dismissed";

function readDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

const noSubscribe = () => () => {};

const WHAT_YOU_GET: Record<AppRole, string> = {
  ADMIN: "Get a notification on your phone when a task you assigned is completed.",
  MANAGER: "Get a notification on your phone when you're given a task or one you assigned is completed.",
  MEMBER: "Get a notification on your phone as soon as you're given a new task.",
};

/**
 * Top-of-workspace nudge to turn notifications on. Also keeps this device's
 * subscription in sync with whoever is signed in (see `usePush`). Hidden once
 * notifications are on, blocked, unsupported, or the banner was dismissed.
 */
export function NotificationBanner({ role, accountHref }: { role: AppRole; accountHref: string }) {
  const { state, busy, enable } = usePush({ sync: true });
  const [dismissedNow, setDismissedNow] = useState(false);
  const dismissedBefore = useSyncExternalStore(noSubscribe, readDismissed, () => true);
  const dismissed = dismissedNow || dismissedBefore;

  function dismiss() {
    setDismissedNow(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Storage blocked: it just shows again next visit.
    }
  }

  async function turnOn() {
    try {
      if (await enable()) toast.success("Notifications are on for this device");
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Could not turn on notifications.");
    }
  }

  if (dismissed || (state !== "off" && state !== "needs-install")) return null;

  return (
    <div className="mb-5 flex items-center gap-3 rounded-2xl border border-sun-line bg-sun-raised/80 p-3 pl-4 text-sm shadow-[var(--sun-shadow)]">
      <span className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-brand-orange-soft text-sun-deep sm:flex">
        {state === "needs-install" ? <Smartphone className="size-[18px]" /> : <Bell className="size-[18px]" />}
      </span>
      <p className="min-w-0 flex-1">
        {state === "needs-install" ? "Add CFM Workplace to your home screen to get task notifications." : WHAT_YOU_GET[role]}
      </p>
      {state === "needs-install" ? (
        <Button asChild size="sm" variant="outline">
          <Link href={accountHref}>Show me how</Link>
        </Button>
      ) : (
        <Button size="sm" onClick={turnOn} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          Turn on
        </Button>
      )}
      <Button size="icon-sm" variant="ghost" onClick={dismiss} aria-label="Dismiss">
        <X />
      </Button>
    </div>
  );
}
