import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/client";
import type { CurrentUser } from "@/server/session";
import { DomainError } from "@/server/access";
import { findViewableAttachment } from "@/server/attachments";
import * as chat from "@/server/chat";
import { csvCell, getWorkReport, parseReportFilters, reportCsv, reportDayStart } from "@/server/reports";

vi.mock("@vercel/blob", () => ({ del: vi.fn(async () => {}), get: vi.fn(), head: vi.fn(), issueSignedToken: vi.fn(), presignUrl: vi.fn() }));
vi.mock("@vercel/blob/client", () => ({ generateClientTokenFromReadWriteToken: vi.fn() }));
process.env.ATTACHMENTS_READ_WRITE_TOKEN = "vercel_blob_rw_test_token";

const users: CurrentUser[] = [];
const teamIds: string[] = [];
async function user(role: Role) {
  const id = randomUUID();
  const record = await prisma.user.create({ data: { id, name: `${role} ${id}`, email: `${id}@test.local`, role }, select: { id: true, name: true, email: true, username: true, image: true, role: true } });
  users.push(record);
  return record;
}
let owner: CurrentUser, hr: CurrentUser, manager: CurrentUser, alice: CurrentUser, bob: CurrentUser;
let ownTeam: string, otherTeam: string;

beforeAll(async () => {
  [owner, hr, manager, alice, bob] = await Promise.all([user("ADMIN"), user("HR"), user("MANAGER"), user("MEMBER"), user("MEMBER")]);
  ownTeam = (await prisma.team.create({ data: { name: "Report scope A", managerId: manager.id } })).id;
  otherTeam = (await prisma.team.create({ data: { name: "Report scope B", managerId: owner.id } })).id;
  teamIds.push(ownTeam, otherTeam);
  await prisma.task.createMany({ data: [
    { title: "=unsafe spreadsheet title", status: "COMPLETED" as const, assignedAt: new Date("2026-10-20T18:30:00Z"), teamId: ownTeam, assigneeId: alice.id },
    { title: "Awaiting review", status: "SUBMITTED" as const, assignedAt: new Date("2026-10-21T18:29:59.999Z"), teamId: ownTeam, assigneeId: alice.id },
    { title: "Outside end day", status: "PENDING" as const, assignedAt: new Date("2026-10-21T18:30:00Z"), teamId: ownTeam, assigneeId: alice.id },
    { title: "Other person", status: "PENDING" as const, assignedAt: new Date("2026-10-21T10:00:00Z"), teamId: ownTeam, assigneeId: bob.id },
    { title: "Other team", status: "PENDING" as const, assignedAt: new Date("2026-10-21T10:00:00Z"), teamId: otherTeam, assigneeId: bob.id },
  ].map((t) => ({ ...t, createdById: owner.id, dueAt: new Date("2026-10-21T12:00:00Z") })) });
});

afterAll(async () => {
  const ids = users.map((u) => u.id);
  await prisma.attachment.deleteMany({ where: { uploaderId: { in: ids } } });
  await prisma.employeeChatMessage.deleteMany({ where: { authorId: { in: ids } } });
  await prisma.employeeChat.deleteMany({ where: { OR: [{ firstId: { in: ids } }, { secondId: { in: ids } }] } });
  await prisma.task.deleteMany({ where: { teamId: { in: teamIds } } });
  await prisma.team.deleteMany({ where: { id: { in: teamIds } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe("direct chat privacy and history", () => {
  it("opens one conversation from either side, including concurrent opens", async () => {
    const [a, b] = await Promise.all([chat.openChat(alice, bob.id), chat.openChat(bob, alice.id)]);
    expect(a.id).toBe(b.id);
    await expect(chat.openChat(alice, alice.id)).rejects.toThrow(DomainError);
  });

  it("only participants can read or send, including when an outsider is owner or HR", async () => {
    const c = await chat.openChat(alice, bob.id);
    await chat.sendChatMessage(alice, c.id, { body: "Private employee update", attachmentIds: [] });
    expect((await chat.getChat(bob, c.id))?.messages.at(-1)?.body).toBe("Private employee update");
    for (const outsider of [owner, hr, manager]) {
      expect(await chat.getChat(outsider, c.id)).toBeNull();
      await expect(chat.sendChatMessage(outsider, c.id, { body: "Intrusion", attachmentIds: [] })).rejects.toThrow(DomainError);
      expect((await chat.listChats(outsider)).some((row) => row.id === c.id)).toBe(false);
    }
  });

  it("keeps files participant-only; prevents draft stealing/reuse and removes deleted files", async () => {
    const c = await chat.openChat(alice, bob.id);
    const file = await prisma.attachment.create({ data: { uploaderId: alice.id, kind: "FILE", name: "plan.pdf", contentType: "application/pdf", size: 300, pathname: `test/${randomUUID()}.pdf` } });
    await expect(chat.sendChatMessage(bob, c.id, { body: "Steal", attachmentIds: [file.id] })).rejects.toThrow(DomainError);
    await chat.sendChatMessage(alice, c.id, { body: "", attachmentIds: [file.id] });
    expect(await findViewableAttachment(bob, file.id)).not.toBeNull();
    for (const outsider of [owner, hr, manager]) expect(await findViewableAttachment(outsider, file.id)).toBeNull();
    await expect(chat.sendChatMessage(alice, c.id, { body: "Reuse", attachmentIds: [file.id] })).rejects.toThrow(DomainError);
    const message = (await prisma.attachment.findUniqueOrThrow({ where: { id: file.id } })).chatMessageId!;
    await expect(chat.deleteChatMessage(bob, message)).rejects.toThrow(DomainError);
    await chat.deleteChatMessage(alice, message);
    expect(await findViewableAttachment(alice, file.id)).toBeNull();
    expect((await prisma.employeeChatMessage.findUniqueOrThrow({ where: { id: message } })).deletedAt).not.toBeNull();
  });

  it("tracks unread messages without moving read markers backwards and enforces the deletion window", async () => {
    const c = await chat.openChat(alice, manager.id);
    await chat.sendChatMessage(alice, c.id, { body: "Update", attachmentIds: [] });
    const page = (await chat.getChat(manager, c.id))!;
    expect((await chat.listChats(manager)).find((r) => r.id === c.id)?.unread).toBe(true);
    await chat.markChatRead(manager, c.id, page.readThrough!);
    await chat.markChatRead(manager, c.id, new Date(0));
    expect((await chat.listChats(manager)).find((r) => r.id === c.id)?.unread).toBe(false);
    const id = page.messages[0].id;
    await prisma.employeeChatMessage.update({ where: { id }, data: { createdAt: new Date(Date.now() - 6 * 60_000) } });
    await expect(chat.deleteChatMessage(alice, id)).rejects.toThrow(DomainError);
  });

  it("preserves paginated history and makes a deleted participant read-only", async () => {
    const c = await chat.openChat(hr, bob.id);
    await prisma.employeeChatMessage.createMany({ data: Array.from({ length: 55 }, (_, i) => ({ chatId: c.id, authorId: bob.id, body: String(i), createdAt: new Date(Date.now() - (60 - i) * 1000) })) });
    const latest = (await chat.getChat(hr, c.id))!;
    expect(latest.messages).toHaveLength(50);
    const older = (await chat.getChat(hr, c.id, latest.messages[0].id))!;
    expect(older.messages).toHaveLength(5);
    expect(new Set([...latest.messages, ...older.messages].map((m) => m.id)).size).toBe(55);
    await prisma.user.update({ where: { id: bob.id }, data: { deletedAt: new Date() } });
    expect((await chat.getChat(hr, c.id))?.person.deletedAt).not.toBeNull();
    await expect(chat.sendChatMessage(hr, c.id, { body: "Cannot send", attachmentIds: [] })).rejects.toThrow(DomainError);
    expect((await chat.listChatPeople(hr)).some((p) => p.id === bob.id)).toBe(false);
  });
});

describe("filtered work reports", () => {
  it("uses inclusive company-local dates, exact employee/team filters and passed-only completion", async () => {
    const report = await getWorkReport(owner, { team: ownTeam, person: alice.id, from: "2026-10-21", to: "2026-10-21" });
    expect(report.rows.map((r) => r.title)).toEqual(["=unsafe spreadsheet title", "Awaiting review"]);
    expect(report.rows.filter((r) => r.status === "COMPLETED")).toHaveLength(1);
    expect(report.rows.find((r) => r.status === "SUBMITTED")?.overdue).toBe(false);
    expect(reportDayStart("2026-10-21").toISOString()).toBe("2026-10-20T18:30:00.000Z");
    expect(reportCsv(report)).toContain("'=unsafe spreadsheet title");
  });

  it("enforces report scopes against forged filters", async () => {
    expect((await getWorkReport(manager, {})).rows.every((r) => r.team.id === ownTeam)).toBe(true);
    expect((await getWorkReport(alice, {})).rows.every((r) => r.assignee.id === alice.id)).toBe(true);
    await expect(getWorkReport(manager, { team: otherTeam })).rejects.toThrow(DomainError);
    await expect(getWorkReport(alice, { person: bob.id })).rejects.toThrow(DomainError);
    expect((await getWorkReport(hr, { team: otherTeam })).rows).toHaveLength(1);
  });

  it("includes teams and employees with no tasks, so a zero-work report can be generated", async () => {
    const empty = await prisma.team.create({ data: { name: "Empty report team", managerId: manager.id } });
    teamIds.push(empty.id);
    const newEmployee = await user("MEMBER");
    await prisma.teamMember.create({ data: { teamId: empty.id, userId: newEmployee.id, addedById: manager.id } });
    const report = await getWorkReport(manager, { team: empty.id, person: newEmployee.id });
    expect(report.rows).toHaveLength(0);
    expect(report.people.some((p) => p.id === newEmployee.id)).toBe(true);
  });

  it("rejects invalid/reversed dates and neutralizes spreadsheet formulas", () => {
    expect(() => parseReportFilters({ from: "2026-02-30" })).toThrow(DomainError);
    expect(() => parseReportFilters({ from: "2026-10-22", to: "2026-10-21" })).toThrow(DomainError);
    expect(csvCell(' =HYPERLINK("x")')).toBe('"\' =HYPERLINK(""x"")"');
  });
});
