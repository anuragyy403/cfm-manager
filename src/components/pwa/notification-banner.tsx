"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Bell, BellOff, Loader2, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AppRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { usePush } from "./pwa";

/** Dismissing the "turn on" nudge doesn't hide the warning that they're blocked. */
const DISMISSED_KEYS = {
  invite: "cfm-push-banner-dismissed",
  blocked: "cfm-push-blocked-dismissed",
};

function readDismissed(key: string) {
  try {
    return localStorage.getItem(key) === "1";
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

const WHAT_YOU_MISS: Record<AppRole, string> = {
  ADMIN: "Notifications are blocked on this device, so you won't hear when tasks are completed.",
  MANAGER: "Notifications are blocked on this device, so you won't hear about new or completed tasks.",
  MEMBER: "Notifications are blocked on this device, so you won't hear about new tasks.",
};

/**
 * Top-of-workspace nudge: turn notifications on, or fix them when they're
 * blocked. Also keeps this device's subscription in sync with whoever is
 * signed in (see `usePush`). Hidden once notifications are on, when the
 * browser can't do them, or when dismissed.
 */
export function NotificationBanner({ role, accountHref }: { role: AppRole; accountHref: string }) {
  const { state, busy, enable } = usePush({ sync: true });
  const kind = state === "denied" ? "blocked" : "invite";
  const [dismissedNow, setDismissedNow] = useState<string[]>([]);
  const dismissedBefore = useSyncExternalStore(noSubscribe, () => readDismissed(DISMISSED_KEYS[kind]), () => true);
  const dismissed = dismissedBefore || dismissedNow.includes(kind);

  function dismiss() {
    setDismissedNow((d) => [...d, kind]);
    try {
      localStorage.setItem(DISMISSED_KEYS[kind], "1");
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

  if (dismissed || !["off", "needs-install", "denied"].includes(state)) return null;

  const icon =
    state === "denied" ? <BellOff className="size-[18px]" /> : state === "needs-install" ? <Smartphone className="size-[18px]" /> : <Bell className="size-[18px]" />;

  return (
    <div
      className={cn(
        "mb-5 flex items-center gap-3 rounded-2xl border p-3 pl-4 text-sm shadow-[var(--sun-shadow)]",
        state === "denied" ? "border-destructive/25 bg-destructive/5" : "border-sun-line bg-sun-raised/80",
      )}
    >
      <span
        className={cn(
          "hidden size-9 shrink-0 items-center justify-center rounded-full sm:flex",
          state === "denied" ? "bg-destructive/10 text-destructive" : "bg-brand-orange-soft text-sun-deep",
        )}
      >
        {icon}
      </span>
      <p className="min-w-0 flex-1">
        {state === "denied"
          ? WHAT_YOU_MISS[role]
          : state === "needs-install"
            ? "Add CFM Workplace to your home screen to get task notifications."
            : WHAT_YOU_GET[role]}
      </p>
      {state === "off" ? (
        <Button size="sm" onClick={turnOn} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          Turn on
        </Button>
      ) : (
        <Button asChild size="sm" variant="outline">
          <Link href={state === "denied" ? `${accountHref}#notifications` : accountHref}>
            {state === "denied" ? "How to fix" : "Show me how"}
          </Link>
        </Button>
      )}
      <Button size="icon-sm" variant="ghost" onClick={dismiss} aria-label="Dismiss">
        <X />
      </Button>
    </div>
  );
}
