/** The SMTP sender, with nodemailer replaced by a fake transport. */
import { afterEach, describe, expect, it, vi } from "vitest";

const { createTransport, sendMail } = vi.hoisted(() => {
  const sendMail = vi.fn(async () => ({}));
  return { sendMail, createTransport: vi.fn(() => ({ sendMail })) };
});
vi.mock("nodemailer", () => ({ default: { createTransport } }));

const { isEmailConfigured, sendEmail } = await import("@/server/email");

const message = { to: "neha@test.local", subject: "Hi", html: "<p>Hi</p>", text: "Hi" };

afterEach(() => {
  vi.unstubAllEnvs();
  createTransport.mockClear();
  sendMail.mockClear();
});

function stubSmtp(port = "465") {
  vi.stubEnv("SMTP_HOST", "smtp.example.test");
  vi.stubEnv("SMTP_PORT", port);
  vi.stubEnv("SMTP_USER", "noreply@example.test");
  vi.stubEnv("SMTP_PASSWORD", "secret");
}

describe("sendEmail", () => {
  it("sends through the configured SMTP server", async () => {
    stubSmtp();
    vi.stubEnv("EMAIL_FROM", "CFM Workplace <noreply@example.test>");
    await sendEmail(message);

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.example.test",
        port: 465,
        secure: true,
        auth: { user: "noreply@example.test", pass: "secret" },
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "CFM Workplace <noreply@example.test>",
        to: "neha@test.local",
        subject: "Hi",
        disableFileAccess: true,
        disableUrlAccess: true,
      }),
    );
  });

  it("uses STARTTLS on port 587", async () => {
    stubSmtp("587");
    await sendEmail(message);
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 587, secure: false, requireTLS: true }));
  });

  it("defaults the sender to the SMTP account", async () => {
    stubSmtp();
    vi.stubEnv("EMAIL_FROM", "");
    await sendEmail(message);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: "CFM Workplace <noreply@example.test>" }));
  });

  it("refuses to run unconfigured in production, without logging the email", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SMTP_HOST", "");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    expect(isEmailConfigured()).toBe(false);
    await expect(sendEmail(message)).rejects.toThrow("Email is not configured");
    expect(info).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
    info.mockRestore();
  });

  it("prints the email instead of sending it in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SMTP_HOST", "");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    expect(isEmailConfigured()).toBe(true);
    await sendEmail(message);
    expect(info).toHaveBeenCalledOnce();
    expect(sendMail).not.toHaveBeenCalled();
    info.mockRestore();
  });
});
