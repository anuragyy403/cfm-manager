import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";
import { appUrl, sendEmail } from "@/server/email";
import { resetPasswordEmail } from "@/server/emails/reset-password";

/** How long a password reset link stays valid. */
export const RESET_LINK_TTL_SECONDS = 60 * 60;

export const auth = betterAuth({
  appName: "CFM Workplace",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: RESET_LINK_TTL_SECONDS,
    // A reset signs the account out on every device.
    revokeSessionsOnPasswordReset: true,
    // Link straight to our own page; it checks the token before showing the form.
    // Better Auth deletes the token when it is used, so each link works once.
    sendResetPassword: async ({ user, token }) => {
      const url = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
      await sendEmail(
        resetPasswordEmail({
          to: user.email,
          name: user.name,
          url,
          baseUrl: appUrl(),
          expiresInMinutes: RESET_LINK_TTL_SECONDS / 60,
        }),
      );
    },
  },
  // Stored in the database so limits hold across serverless instances.
  rateLimit: {
    enabled: process.env.NODE_ENV === "production" || process.env.AUTH_RATE_LIMIT === "on",
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-in/username": { window: 60, max: 5 },
      "/sign-up/email": { window: 300, max: 5 },
      "/request-password-reset": { window: 900, max: 3 },
      "/reset-password": { window: 300, max: 10 },
      "/change-password": { window: 300, max: 5 },
    },
  },
  user: {
    additionalFields: {
      // `input: false` means sign-up and profile-update requests can never set
      // the role. New accounts are always MEMBER; ADMIN is granted server-side.
      role: {
        type: "string",
        required: false,
        defaultValue: "MEMBER",
        input: false,
      },
    },
  },
  plugins: [
    username({ minUsernameLength: 3, maxUsernameLength: 30 }),
    // Must stay last so auth calls from Server Actions can set cookies.
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
