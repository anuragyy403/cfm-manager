import "server-only";
import webpush, { WebPushError } from "web-push";
import { z } from "zod";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { HOME_PATHS } from "@/lib/roles";
import { completedOnTime } from "@/lib/tasks/rules";
import type { CurrentUser } from "@/server/session";

/**
 * Phone / browser notifications over Web Push.
 *
 * Each device that turns notifications on stores a `PushSubscription`. To
 * notify someone we send to every device they have; devices the push service
 * reports as gone (app removed, permission revoked) are deleted.
 *
 * Sending never throws: a notification that fails must not undo or block the
 * task change that caused it. Callers run these inside `after()`.
 */

function configure() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:clickfieldmedia@gmail.com", publicKey, privateKey);
  return true;
}

// ─── Devices ────────────────────────────────────────────────────────────────

/**
 * Only the browsers' own push services. The server sends requests to the
 * stored endpoint, so an arbitrary URL here would let anyone make it call
 * other sites.
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge on Android, Samsung Internet
  /^android\.googleapis\.com$/,
  /^web\.push\.apple\.com$/, // Safari, iPhone home-screen apps
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /\.notify\.windows\.com$/, // Edge on Windows
];

export const pushSubscriptionSchema = z.object({
  endpoint: z
    .url()
    .max(1000)
    .refine((value) => {
      // Zod still runs this when the URL check above failed.
      if (!URL.canParse(value)) return false;
      const url = new URL(value);
      return url.protocol === "https:" && PUSH_HOSTS.some((host) => host.test(url.hostname));
    }, "Unsupported push service."),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

/** Saves this device for the signed-in user. A device moves to whoever signed in on it last. */
export async function savePushSubscription(user: CurrentUser, sub: PushSubscriptionInput, userAgent: string | null) {
  const data = {
    userId: user.id,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    userAgent: userAgent?.slice(0, 300) ?? null,
  };
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { endpoint: sub.endpoint, ...data },
    update: data,
  });
}

export async function removePushSubscription(user: CurrentUser, endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
}

// ─── Sending ────────────────────────────────────────────────────────────────

export type PushMessage = {
  title: string;
  body: string;
  /** Page to open when the notification is tapped. */
  url: string;
  /** Notifications with the same tag replace each other (one per task). */
  tag?: string;
};

/** Sends to every device of one person. Returns how many devices accepted it. */
export async function sendPushToUser(userId: string, message: PushMessage): Promise<number> {
  if (!configure()) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[push] (not sent: VAPID keys are not set) to ${userId}: ${message.title}: ${message.body}`);
    }
    return 0;
  }
  const devices = await prisma.pushSubscription.findMany({ where: { userId } });
  const payload = JSON.stringify(message);

  const results = await Promise.all(
    devices.map(async (device) => {
      try {
        await webpush.sendNotification(
          { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
          payload,
          { TTL: 60 * 60 * 24, urgency: "high" },
        );
        return true;
      } catch (e) {
        if (e instanceof WebPushError && (e.statusCode === 404 || e.statusCode === 410)) {
          await prisma.pushSubscription.deleteMany({ where: { id: device.id } });
        } else {
          console.error("[push] send failed", e instanceof WebPushError ? e.statusCode : e);
        }
        return false;
      }
    }),
  );
  return results.filter(Boolean).length;
}

async function safely(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    console.error(`[push] ${label} failed`, e);
  }
}

const taskForNotice = {
  id: true,
  title: true,
  dueAt: true,
  completedAt: true,
  createdById: true,
  assignee: { select: { id: true, name: true, role: true } },
  team: { select: { managerId: true, manager: { select: { role: true } } } },
  createdBy: { select: { role: true } },
} as const;

function taskUrl(role: keyof typeof HOME_PATHS, taskId: string) {
  return `${HOME_PATHS[role]}/tasks/${taskId}`;
}

/** Tells the assignee they have a new task (or one was reassigned to them). */
export function notifyTaskAssigned(taskId: string, actor: CurrentUser, reassigned = false) {
  return safely("assigned notice", async () => {
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: taskForNotice });
    if (!task || task.assignee.id === actor.id) return;
    await sendPushToUser(task.assignee.id, {
      title: reassigned ? `${actor.name} reassigned a task to you` : `New task from ${actor.name}`,
      body: `${task.title} · due ${formatDateTime(task.dueAt)}`,
      url: taskUrl(task.assignee.role, task.id),
      tag: `task-${task.id}`,
    });
  });
}

type Role = keyof typeof HOME_PATHS;

/** Whoever assigned the task plus the team's manager, never the person who completed it. */
export function completionRecipients(
  task: { createdById: string; createdBy: { role: Role }; team: { managerId: string; manager: { role: Role } } },
  completedById: string,
): [string, Role][] {
  const recipients = new Map<string, Role>([
    [task.createdById, task.createdBy.role],
    [task.team.managerId, task.team.manager.role],
  ]);
  recipients.delete(completedById);
  return [...recipients];
}

/**
 * Tells the person who assigned the task, and the team's manager if that is
 * someone else, that it has been completed.
 */
export function notifyTaskCompleted(taskId: string, actor: CurrentUser) {
  return safely("completed notice", async () => {
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: taskForNotice });
    if (!task?.completedAt) return;

    const onTime = completedOnTime({ completedAt: task.completedAt, dueAt: task.dueAt });
    await Promise.all(
      completionRecipients(task, actor.id).map(([userId, role]) =>
        sendPushToUser(userId, {
          title: `${actor.name} completed a task`,
          body: `${task.title} · ${onTime ? "on time" : "after the deadline"}`,
          url: taskUrl(role, task.id),
          tag: `task-${task.id}`,
        }),
      ),
    );
  });
}
