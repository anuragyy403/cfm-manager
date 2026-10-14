import "server-only";
import nodemailer from "nodemailer";

/**
 * Outgoing email over SMTP. Works with any provider: a Gmail account (with an
 * App Password), a Hostinger mailbox, Resend's SMTP, and so on. Only the
 * SMTP_* settings change.
 *
 * Without SMTP settings:
 * - in development the message is printed to the server console instead, so
 *   the reset flow can be tried locally;
 * - in production sending fails loudly. Emails are never logged there, since
 *   a reset link in a log would let anyone with log access take an account.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function smtpSettings() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) return null;
  const port = Number(SMTP_PORT || 465);
  return {
    host: SMTP_HOST,
    port,
    // 465 uses TLS from the start; 587 upgrades with STARTTLS (required below).
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  };
}

export function isEmailConfigured() {
  return smtpSettings() !== null || process.env.NODE_ENV !== "production";
}

/** Public base URL of the app, used for links and images inside emails. */
export function appUrl() {
  const url =
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return url.replace(/\/+$/, "");
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  const settings = smtpSettings();

  if (!settings) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email is not configured: set SMTP_HOST, SMTP_USER, SMTP_PASSWORD and EMAIL_FROM.");
    }
    console.info(
      `\n[email] (dev: not sent, SMTP is not configured)\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`,
    );
    return;
  }

  const transport = nodemailer.createTransport({
    ...settings,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  await transport.sendMail({
    // Most providers only accept a From address that belongs to the SMTP account.
    from: process.env.EMAIL_FROM || `CFM Workplace <${settings.auth.user}>`,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    // Our own content only: never let a message pull in local files or URLs.
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}
