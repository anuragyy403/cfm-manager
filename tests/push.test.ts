/**
 * Phone notifications: who gets told about handed-in work, which device
 * addresses are accepted, and that a shared device follows whoever signed in.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { pushSubscriptionSchema, savePushSubscription, submissionRecipients } from "@/server/push";
import type { CurrentUser } from "@/server/session";

const keys = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" };

describe("submitted-for-review notice recipients", () => {
  const owner = { id: "owner" };
  const task = (assigneeId: string, createdById: string, createdByRole: "ADMIN" | "MANAGER", managerId: string) => ({
    assigneeId,
    createdById,
    createdBy: { role: createdByRole },
    team: { managerId, manager: { role: "MANAGER" as const } },
  });

  it("tells the manager, who reviews their team's work", () => {
    expect(submissionRecipients(task("alice", "mia", "MANAGER", "mia"), owner)).toEqual([["mia", "MANAGER"]]);
  });

  it("tells the team's manager (the reviewer) and the owner who assigned it", () => {
    expect(submissionRecipients(task("alice", "owner", "ADMIN", "mia"), owner)).toEqual([
      ["mia", "MANAGER"],
      ["owner", "ADMIN"],
    ]);
  });

  it("sends a manager's own work to the owner, never to the manager", () => {
    // The owner gave Mia (the manager) a task; Mia hands it in.
    expect(submissionRecipients(task("mia", "owner", "ADMIN", "mia"), owner)).toEqual([["owner", "ADMIN"]]);
    // Mia gave herself a task: the owner still reviews it.
    expect(submissionRecipients(task("mia", "mia", "MANAGER", "mia"), owner)).toEqual([["owner", "ADMIN"]]);
  });
});

describe("push subscription input", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://web.push.apple.com/QGx1",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
  ])("accepts %s", (endpoint) => {
    expect(pushSubscriptionSchema.safeParse({ endpoint, keys }).success).toBe(true);
  });

  it.each([
    "https://example.com/hook",
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://fcm.googleapis.com.evil.test/x",
    "not a url",
  ])("rejects %s", (endpoint) => {
    expect(pushSubscriptionSchema.safeParse({ endpoint, keys }).success).toBe(false);
  });
});

describe("saving a device", () => {
  const created: string[] = [];
  async function makeUser(name: string): Promise<CurrentUser> {
    const username = `${name}${randomUUID().slice(0, 6)}`;
    const user = await prisma.user.create({
      data: { id: randomUUID(), name, email: `${username}@test.local`, username },
      select: { id: true, name: true, email: true, username: true, image: true, role: true },
    });
    created.push(user.id);
    return user;
  }

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: created } } });
  });

  it("moves a shared phone to whoever signed in on it last", async () => {
    const first = await makeUser("first");
    const second = await makeUser("second");
    const endpoint = `https://fcm.googleapis.com/fcm/send/${randomUUID()}`;

    await savePushSubscription(first, { endpoint, keys }, "test");
    await savePushSubscription(second, { endpoint, keys }, "test");

    const rows = await prisma.pushSubscription.findMany({ where: { endpoint } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe(second.id);
  });
});
