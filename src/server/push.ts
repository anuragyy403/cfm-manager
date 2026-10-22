import "server-only";
import webpush, { WebPushError } from "web-push";
import { z } from "zod";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { HOME_PATHS } from "@/lib/roles";
import { reviewerIsOwner, submittedOnTime } from "@/lib/tasks/rules";
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
  submittedAt: true,
  reviewNote: true,
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

/** Shortens feedback so it fits in a notification. */
function excerpt(text: string, max = 120) {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

/**
 * Who hears about handed-in work: the reviewer (the team's manager, or the
 * owner for a manager's own work) and whoever assigned it. Never the person
 * who handed it in.
 */
export function submissionRecipients(
  task: {
    assigneeId: string;
    createdById: string;
    createdBy: { role: Role };
    team: { managerId: string; manager: { role: Role } };
  },
  owner: { id: string } | null,
): [string, Role][] {
  const recipients = new Map<string, Role>();
  if (reviewerIsOwner(task)) {
    if (owner) recipients.set(owner.id, "ADMIN");
  } else {
    recipients.set(task.team.managerId, task.team.manager.role);
  }
  recipients.set(task.createdById, task.createdBy.role);
  recipients.delete(task.assigneeId);
  return [...recipients];
}

/** Tells the reviewer (and whoever assigned it) that work is waiting for review. */
export function notifyTaskSubmitted(taskId: string, actor: CurrentUser) {
  return safely("submitted notice", async () => {
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: taskForNotice });
    if (!task?.submittedAt) return;
    const owner = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
    const late = !submittedOnTime({ submittedAt: task.submittedAt, dueAt: task.dueAt });

    await Promise.all(
      submissionRecipients({ ...task, assigneeId: task.assignee.id }, owner).map(([userId, role]) =>
        sendPushToUser(userId, {
          title: `${actor.name} submitted a task for review`,
          body: `${task.title}${late ? " · after the deadline" : ""} · please check it and pass or fail it`,
          url: taskUrl(role, task.id),
          tag: `task-${task.id}`,
        }),
      ),
    );
  });
}

/** Tells the assignee their work passed, or what to change. */
export function notifyTaskReviewed(taskId: string, actor: CurrentUser, decision: "PASS" | "FAIL") {
  return safely("review notice", async () => {
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: taskForNotice });
    if (!task) return;
    const feedback = task.reviewNote ? excerpt(task.reviewNote) : null;
    await sendPushToUser(task.assignee.id, {
      title: decision === "PASS" ? `✅ ${actor.name} passed your task` : "Changes needed on your task",
      body:
        decision === "PASS"
          ? `${task.title}${feedback ? ` · “${feedback}”` : " · it now counts as done"}`
          : `${task.title} · ${actor.name}: “${feedback ?? "see the task for details"}”`,
      url: taskUrl(task.assignee.role, task.id),
      tag: `task-${task.id}`,
    });
  });
}

/** Tells the assignee a completed task was reopened, with the reason. */
export function notifyTaskReopened(taskId: string, actor: CurrentUser) {
  return safely("reopened notice", async () => {
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: taskForNotice });
    if (!task || task.assignee.id === actor.id) return;
    await sendPushToUser(task.assignee.id, {
      title: `${actor.name} reopened a task`,
      body: `${task.title}${task.reviewNote ? ` · “${excerpt(task.reviewNote)}”` : ""}`,
      url: taskUrl(task.assignee.role, task.id),
      tag: `task-${task.id}`,
    });
  });
}

// ─── Teams ──────────────────────────────────────────────────────────────────

/** Where a team opens for each role: employees have one team page, leads open it by id. */
function teamUrl(role: Role, teamId: string) {
  return role === "MEMBER" ? `${HOME_PATHS.MEMBER}/team` : `${HOME_PATHS[role]}/teams/${teamId}`;
}

/** Everyone on a team (its manager and employees) except the people listed. */
async function teamAudience(teamId: string, except: string[]) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      name: true,
      manager: { select: { id: true, role: true } },
      members: { select: { user: { select: { id: true, role: true } } } },
    },
  });
  if (!team) return null;
  const people = [team.manager, ...team.members.map((m) => m.user)].filter((p) => !except.includes(p.id));
  return { name: team.name, people };
}

/**
 * Someone joined or left a team. They hear about it themselves, and so does
 * everyone else on the team (and on the team they left, when moved).
 */
export function notifyMembershipChanged(
  change: { kind: "added"; teamId: string; userId: string; fromTeamId: string | null } | { kind: "removed"; teamId: string; userId: string },
  actor: CurrentUser,
) {
  return safely("team change notice", async () => {
    const person = await prisma.user.findUnique({ where: { id: change.userId }, select: { id: true, name: true, role: true } });
    if (!person) return;
    const except = [person.id, actor.id];
    const team = await teamAudience(change.teamId, except);
    if (!team) return;
    const sends: Promise<number>[] = [];

    if (change.kind === "added") {
      sends.push(
        sendPushToUser(person.id, {
          title: `You've been added to ${team.name}`,
          body: `${actor.name} added you. Open the app to see your team and manager.`,
          url: teamUrl(person.role, change.teamId),
          tag: `team-${person.id}`,
        }),
      );
      for (const p of team.people) {
        sends.push(
          sendPushToUser(p.id, {
            title: `${person.name} joined ${team.name}`,
            body: `Added by ${actor.name}.`,
            url: teamUrl(p.role, change.teamId),
            tag: `team-${change.teamId}-${person.id}`,
          }),
        );
      }
      if (change.fromTeamId) {
        const old = await teamAudience(change.fromTeamId, except);
        for (const p of old?.people ?? []) {
          sends.push(
            sendPushToUser(p.id, {
              title: `${person.name} left ${old!.name}`,
              body: `${actor.name} moved them to ${team.name}. Their tasks and history stay with ${old!.name}.`,
              url: teamUrl(p.role, change.fromTeamId),
              tag: `team-${change.fromTeamId}-${person.id}`,
            }),
          );
        }
      }
    } else {
      sends.push(
        sendPushToUser(person.id, {
          title: `You've been removed from ${team.name}`,
          body: `${actor.name} removed you. Your earlier tasks are still in My tasks.`,
          url: HOME_PATHS[person.role],
          tag: `team-${person.id}`,
        }),
      );
      for (const p of team.people) {
        sends.push(
          sendPushToUser(p.id, {
            title: `${person.name} left ${team.name}`,
            body: `Removed by ${actor.name}.`,
            url: teamUrl(p.role, change.teamId),
            tag: `team-${change.teamId}-${person.id}`,
          }),
        );
      }
    }
    await Promise.all(sends);
  });
}

/** A team got a new manager: the team and the new manager hear about it. */
export function notifyManagerChanged(teamId: string, actor: CurrentUser) {
  return safely("manager change notice", async () => {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { name: true, manager: { select: { id: true, name: true, role: true } } },
    });
    if (!team) return;
    const audience = await teamAudience(teamId, [actor.id, team.manager.id]);
    await Promise.all([
      team.manager.id !== actor.id
        ? sendPushToUser(team.manager.id, {
            title: `You now manage ${team.name}`,
            body: `${actor.name} put you in charge of this team.`,
            url: teamUrl(team.manager.role, teamId),
            tag: `team-${teamId}-manager`,
          })
        : Promise.resolve(0),
      ...(audience?.people ?? []).map((p) =>
        sendPushToUser(p.id, {
          title: `${team.manager.name} is now the manager of ${team.name}`,
          body: "They'll assign and review your work from now on.",
          url: teamUrl(p.role, teamId),
          tag: `team-${teamId}-manager`,
        }),
      ),
    ]);
  });
}

// ─── Private conversations with the owner ──────────────────────────────────

export type ConversationEvent = "case" | "message" | "report" | "resolved" | "reopened";

/**
 * Tells the other side of a private conversation that something happened:
 * the owner hears from whoever raised a case (or from HR), and they hear back
 * from the owner. Never includes what was written, so nothing private shows
 * on a locked phone screen.
 */
export function notifyConversation(conversationId: string, actor: CurrentUser, event: ConversationEvent) {
  return safely("conversation notice", async () => {
    const convo = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, kind: true, creator: { select: { id: true, role: true } } },
    });
    if (!convo) return;
    const fromOwner = actor.role === "ADMIN";
    const owner = fromOwner ? null : await prisma.user.findFirst({ where: { role: "ADMIN", deletedAt: null }, select: { id: true } });
    const to = fromOwner ? convo.creator : owner ? { id: owner.id, role: "ADMIN" as const } : null;
    if (!to || to.id === actor.id) return;

    const isCase = convo.kind === "OWNER_CASE";
    const title = {
      case: `${actor.name} raised a private concern`,
      message: fromOwner ? "The owner replied to you" : `New message from ${actor.name}`,
      report: `New meeting report from ${actor.name}`,
      resolved: "The owner marked your concern resolved",
      reopened: "The owner reopened your concern",
    }[event];
    const url = fromOwner
      ? isCase
        ? `${HOME_PATHS[to.role]}/talk/${convo.id}`
        : "/hr/reports"
      : `/admin/inbox/${convo.id}`;
    await sendPushToUser(to.id, {
      title,
      body: "Open CFM Workplace to read it. Only you two can see it.",
      url,
      tag: `conversation-${convo.id}`,
    });
  });
}
