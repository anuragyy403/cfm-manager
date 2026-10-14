/**
 * Password reset and change-password, run through Better Auth against the
 * local test database. Emails are captured instead of sent.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailMessage } from "@/server/email";

const { outbox, sendEmail } = vi.hoisted(() => {
  const outbox: EmailMessage[] = [];
  return { outbox, sendEmail: vi.fn(async (m: EmailMessage) => void outbox.push(m)) };
});
vi.mock("@/server/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/email")>()),
  sendEmail,
}));

const { auth } = await import("@/lib/auth");
const { prisma } = await import("@/lib/prisma");
const { isResetTokenValid, sendMemberPasswordReset } = await import("@/server/password-reset");
const { DomainError } = await import("@/server/access");
const { resetPasswordEmail } = await import("@/server/emails/reset-password");

const OLD = "old-password-123";
const NEW = "new-password-456";

async function wipe() {
  await prisma.taskActivity.deleteMany();
  await prisma.task.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
}

async function signUp(name: string) {
  const username = `${name.toLowerCase()}${randomUUID().slice(0, 6)}`;
  const email = `${username}@test.local`;
  const res = await auth.api.signUpEmail({ body: { name, email, password: OLD, username } });
  return { id: res.user.id, email, name };
}

/** Signs in and returns request headers carrying that session's cookie. */
async function signIn(email: string, password: string) {
  const { headers } = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
  const cookie = headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

const canSignIn = (email: string, password: string) =>
  auth.api.signInEmail({ body: { email, password } }).then(
    () => true,
    () => false,
  );

/** The token from the most recent email's reset link. */
function lastToken() {
  const text = outbox.at(-1)?.text ?? "";
  const match = text.match(/\/reset-password\?token=([^\s]+)/);
  if (!match) throw new Error("No reset link in the last email");
  return decodeURIComponent(match[1]);
}

beforeEach(async () => {
  await wipe();
  outbox.length = 0;
  sendEmail.mockClear();
});

afterAll(wipe);

describe("forgot password", () => {
  it("answers the same way for an unknown email and sends nothing", async () => {
    const res = await auth.api.requestPasswordReset({ body: { email: "nobody@test.local" } });
    expect(res.status).toBe(true);
    expect(outbox).toHaveLength(0);
  });

  it("emails a link that sets the new password once", async () => {
    const user = await signUp("Riya");
    await auth.api.requestPasswordReset({ body: { email: user.email } });

    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe(user.email);
    expect(outbox[0].text).toContain("http://localhost:3000/reset-password?token=");
    const token = lastToken();
    expect(await isResetTokenValid(token)).toBe(true);

    await auth.api.resetPassword({ body: { token, newPassword: NEW } });
    expect(await canSignIn(user.email, OLD)).toBe(false);
    expect(await canSignIn(user.email, NEW)).toBe(true);

    // The same link can't be used again.
    expect(await isResetTokenValid(token)).toBe(false);
    await expect(
      auth.api.resetPassword({ body: { token, newPassword: "another-pass-789" } }),
    ).rejects.toMatchObject({ body: { code: "INVALID_TOKEN" } });
  });

  it("rejects an expired link", async () => {
    const user = await signUp("Kabir");
    await auth.api.requestPasswordReset({ body: { email: user.email } });
    const token = lastToken();
    await prisma.verification.updateMany({
      where: { identifier: `reset-password:${token}` },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await isResetTokenValid(token)).toBe(false);
    await expect(auth.api.resetPassword({ body: { token, newPassword: NEW } })).rejects.toMatchObject({
      body: { code: "INVALID_TOKEN" },
    });
    expect(await canSignIn(user.email, OLD)).toBe(true);
  });

  it("rejects a made-up token", async () => {
    expect(await isResetTokenValid("made-up-token")).toBe(false);
    expect(await isResetTokenValid(undefined)).toBe(false);
    await expect(
      auth.api.resetPassword({ body: { token: "made-up-token", newPassword: NEW } }),
    ).rejects.toMatchObject({ body: { code: "INVALID_TOKEN" } });
  });

  it("links expire after one hour", async () => {
    const user = await signUp("Meera");
    await auth.api.requestPasswordReset({ body: { email: user.email } });
    const row = await prisma.verification.findFirstOrThrow({
      where: { identifier: `reset-password:${lastToken()}` },
    });
    const minutes = (row.expiresAt.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(59);
    expect(minutes).toBeLessThanOrEqual(60);
  });

  it("signs the account out everywhere after a reset", async () => {
    const user = await signUp("Arjun");
    await signIn(user.email, OLD);
    await signIn(user.email, OLD);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBeGreaterThanOrEqual(2);

    await auth.api.requestPasswordReset({ body: { email: user.email } });
    await auth.api.resetPassword({ body: { token: lastToken(), newPassword: NEW } });
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe("change password while signed in", () => {
  it("rejects a wrong current password", async () => {
    const user = await signUp("Dev");
    const headers = await signIn(user.email, OLD);
    await expect(
      auth.api.changePassword({ headers, body: { currentPassword: "not-my-password", newPassword: NEW } }),
    ).rejects.toMatchObject({ body: { code: "INVALID_PASSWORD" } });
    expect(await canSignIn(user.email, OLD)).toBe(true);
  });

  it("requires a signed-in session", async () => {
    await expect(
      auth.api.changePassword({ headers: new Headers(), body: { currentPassword: OLD, newPassword: NEW } }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("changes the password and can sign out other devices", async () => {
    const user = await signUp("Sana");
    await signIn(user.email, OLD); // another device
    const headers = await signIn(user.email, OLD); // this device
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(3); // + sign-up session

    await auth.api.changePassword({
      headers,
      body: { currentPassword: OLD, newPassword: NEW, revokeOtherSessions: true },
    });
    expect(await canSignIn(user.email, OLD)).toBe(false);
    // Only this device's (renewed) session survived; the check above failed so it added none.
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
    expect(await canSignIn(user.email, NEW)).toBe(true);
  });
});

describe("a lead sends someone a reset email", () => {
  async function lead(role: "ADMIN" | "MANAGER") {
    return prisma.user.create({
      data: { id: randomUUID(), name: role, email: `${role.toLowerCase()}${randomUUID().slice(0, 6)}@test.local`, role },
      select: { id: true, name: true, email: true, username: true, image: true, role: true },
    });
  }
  async function setup() {
    const admin = await lead("MANAGER");
    const member = await signUp("Neha");
    const outsider = await signUp("Omar");
    await prisma.team.create({
      data: { name: "Team", managerId: admin.id, members: { create: [{ userId: member.id }] } },
    });
    return { admin, member, outsider };
  }

  it("the owner can send one to anyone", async () => {
    const owner = await lead("ADMIN");
    const { outsider } = await setup();
    await sendMemberPasswordReset(owner, outsider.id);
    expect(outbox).toHaveLength(1);
  });

  it("a manager emails a working one-time link to someone on their team", async () => {
    const { admin, member } = await setup();
    const res = await sendMemberPasswordReset(admin, member.id);
    expect(res.email).toBe(member.email);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe(member.email);

    const token = lastToken();
    expect(await isResetTokenValid(token)).toBe(true);
    await auth.api.resetPassword({ body: { token, newPassword: NEW } });
    expect(await canSignIn(member.email, NEW)).toBe(true);
    await expect(auth.api.resetPassword({ body: { token, newPassword: OLD } })).rejects.toMatchObject({
      body: { code: "INVALID_TOKEN" },
    });
  });

  it("a manager can't send one to people who aren't on their team", async () => {
    const { admin, outsider } = await setup();
    await expect(sendMemberPasswordReset(admin, outsider.id)).rejects.toThrow(DomainError);
    expect(outbox).toHaveLength(0);
  });

  it("tells the lead when the email fails and leaves no usable link behind", async () => {
    const { admin, member } = await setup();
    sendEmail.mockRejectedValueOnce(new Error("Resend is down"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    await expect(sendMemberPasswordReset(admin, member.id)).rejects.toThrow("couldn't be sent");
    expect(await prisma.verification.count({ where: { value: member.id } })).toBe(0);
  });
});

describe("reset email", () => {
  it("escapes the person's name and includes the link", () => {
    const m = resetPasswordEmail({
      to: "a@test.local",
      name: "<script>alert(1)</script> Smith",
      url: "https://example.test/reset-password?token=abc",
      baseUrl: "https://example.test",
    });
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
    expect(m.html).toContain('href="https://example.test/reset-password?token=abc"');
    expect(m.text).toContain("https://example.test/reset-password?token=abc");
    expect(m.subject).toBe("Reset your CFM Workplace password");
  });
});
