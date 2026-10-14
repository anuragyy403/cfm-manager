import { APP_NAME, COMPANY } from "@/components/brand";
import type { EmailMessage } from "@/server/email";

const NAVY = "#0c243e";
const ORANGE = "#e65e15";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The "Reset your password" email. Table layout with inline styles, because
 * that is what email clients (Gmail, Outlook) render reliably.
 */
export function resetPasswordEmail({
  to,
  name,
  url,
  baseUrl,
  expiresInMinutes = 60,
}: {
  to: string;
  name: string;
  url: string;
  baseUrl: string;
  expiresInMinutes?: number;
}): EmailMessage {
  const firstName = name.trim().split(/\s+/)[0] || "there";
  const safeName = escapeHtml(firstName);
  const safeUrl = escapeHtml(url);
  const address = COMPANY.address.map(escapeHtml).join(", ");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#f3f5f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">Choose a new password for your ${APP_NAME} account. The link expires in ${expiresInMinutes} minutes.</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f8;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(12,36,62,0.08);">
      <tr>
        <td style="background:${NAVY};padding:22px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;"><img src="${escapeHtml(baseUrl)}/logo.png" width="40" height="40" alt="${COMPANY.name}" style="display:block;border-radius:50%;background:#ffffff;"></td>
            <td style="vertical-align:middle;padding-left:12px;">
              <div style="color:#ffffff;font-size:17px;font-weight:600;line-height:1.2;">${APP_NAME}</div>
              <div style="color:rgba(255,255,255,0.6);font-size:12px;line-height:1.4;">by ${COMPANY.name}</div>
            </td>
          </tr></table>
        </td>
      </tr>
      <tr><td style="height:4px;background:${ORANGE};line-height:4px;font-size:0;">&nbsp;</td></tr>
      <tr>
        <td style="padding:32px 28px 8px;">
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${NAVY};">Reset your password</h1>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Hi ${safeName},</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">We received a request to reset the password for your ${APP_NAME} account (<strong>${escapeHtml(to)}</strong>). Click the button below to choose a new one.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr>
            <td style="border-radius:10px;background:${ORANGE};">
              <a href="${safeUrl}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">Reset password</a>
            </td>
          </tr></table>
          <p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#6b7280;">This link works once and expires in ${expiresInMinutes} minutes. After you reset, you will be signed out on all your devices.</p>
          <p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#6b7280;">If you didn't ask for this, you can ignore this email. Your password won't change.</p>
          <p style="margin:0 0 24px;font-size:12px;line-height:1.6;color:#9ca3af;">Button not working? Copy this link into your browser:<br><a href="${safeUrl}" style="color:${ORANGE};word-break:break-all;">${safeUrl}</a></p>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #eef1f5;font-size:12px;line-height:1.6;color:#6b7280;">
          ${COMPANY.name} · ${address}<br>
          <a href="${COMPANY.website}" style="color:#6b7280;">${COMPANY.websiteLabel}</a> · ${escapeHtml(COMPANY.phone)}
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    `Hi ${firstName},`,
    "",
    `We received a request to reset the password for your ${APP_NAME} account (${to}).`,
    "Open this link to choose a new one:",
    "",
    url,
    "",
    `The link works once and expires in ${expiresInMinutes} minutes. After you reset, you will be signed out on all your devices.`,
    "If you didn't ask for this, you can ignore this email. Your password won't change.",
    "",
    `${COMPANY.name} · ${COMPANY.address.join(", ")}`,
  ].join("\n");

  return { to, subject: `Reset your ${APP_NAME} password`, html, text };
}
