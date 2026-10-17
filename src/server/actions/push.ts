"use server";

import { headers } from "next/headers";
import type { ActionResult } from "@/lib/validation";
import { pushSubscriptionSchema, removePushSubscription, savePushSubscription, sendPushToUser } from "@/server/push";
import { getCurrentUser, homePathFor } from "@/server/session";

/**
 * Server Actions for turning notifications on and off on this device. Anyone
 * signed in can manage their own devices, and only their own.
 */

export async function savePushSubscriptionAction(subscription: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again to turn on notifications." };
  const parsed = pushSubscriptionSchema.safeParse(subscription);
  if (!parsed.success) return { ok: false, error: "This browser's notifications aren't supported." };
  await savePushSubscription(user, parsed.data, (await headers()).get("user-agent"));
  return { ok: true };
}

export async function removePushSubscriptionAction(endpoint: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || typeof endpoint !== "string") return { ok: true };
  await removePushSubscription(user, endpoint.slice(0, 1000));
  return { ok: true };
}

export async function sendTestPushAction(): Promise<ActionResult<{ devices: number }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again." };
  const devices = await sendPushToUser(user.id, {
    title: "Notifications are on",
    body: "You'll get a notification here when a task is given to you or completed.",
    url: `${homePathFor(user.role)}/account`,
    tag: "test",
  });
  if (devices === 0) return { ok: false, error: "No notification could be sent to this device. Turn notifications off and on again." };
  return { ok: true, data: { devices } };
}
