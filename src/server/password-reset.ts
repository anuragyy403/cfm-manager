import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { RESET_LINK_TTL_SECONDS } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appUrl, isEmailConfigured, sendEmail } from "@/server/email";
import { resetPasswordEmail } from "@/server/emails/reset-password";
import type { CurrentUser } from "@/server/session";
import { DomainError, isOwner, teamScope } from "@/server/access";

/**
 * Whether a reset link's token can still be used (exists, not used, not
 * expired). Lets the reset page say "this link has expired" up front instead
 * of after the person has typed a new password. Better Auth re-checks the
 * token when the new password is submitted.
 */
export async function isResetTokenValid(token: string | undefined): Promise<boolean> {
  if (!token || token.length > 128) return false;
  const row = await prisma.verification.findFirst({
    where: { identifier: `reset-password:${token}`, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  return row !== null;
}

/**
 * A lead helps a locked-out colleague: emails them a password reset link.
 * The owner can do this for anyone; a manager only for employees on their
 * teams. The lead never sees the link or the new password.
 *
 * The token is stored exactly as Better Auth's own "forgot password" flow
 * stores it, so the normal reset page and `/reset-password` endpoint accept
 * it (one use, same expiry). It is issued here rather than through
 * `auth.api.requestPasswordReset` because that call hides email failures,
 * and the lead needs to know if the email didn't go out.
 */
export async function sendMemberPasswordReset(viewer: CurrentUser, userId: string) {
  if (userId === viewer.id) throw new DomainError("Use Account settings to change your own password.");
  const target = await prisma.user.findFirst({
    where: isOwner(viewer)
      ? { id: userId }
      : { id: userId, role: "MEMBER", memberships: { some: { team: teamScope(viewer) } } },
    select: { email: true, name: true },
  });
  if (!target) throw new DomainError("That person isn't on your team.");
  if (!isEmailConfigured()) {
    throw new DomainError("Email sending isn't set up yet, so the reset email can't be sent.");
  }

  const { email, name } = target;
  const token = randomBytes(24).toString("base64url");
  const identifier = `reset-password:${token}`;
  await prisma.verification.create({
    data: {
      id: randomUUID(),
      identifier,
      value: userId,
      expiresAt: new Date(Date.now() + RESET_LINK_TTL_SECONDS * 1000),
    },
  });

  try {
    await sendEmail(
      resetPasswordEmail({
        to: email,
        name,
        url: `${appUrl()}/reset-password?token=${token}`,
        baseUrl: appUrl(),
        expiresInMinutes: RESET_LINK_TTL_SECONDS / 60,
      }),
    );
  } catch (e) {
    await prisma.verification.deleteMany({ where: { identifier } });
    console.error("Password reset email (sent by a lead) failed:", e);
    throw new DomainError("The reset email couldn't be sent. Please try again in a few minutes.");
  }
  return { email, name };
}
