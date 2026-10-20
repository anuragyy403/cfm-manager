import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
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
      // A deleted account gets no link (the request still looks the same).
      if (await isDeleted(user.id)) return;
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
  databaseHooks: {
    // Photos are only set by our own upload (src/server/photos.ts), never
    // through Better Auth's sign-up or update-profile calls.
    user: {
      create: { before: async (user) => ({ data: { ...user, image: null } }) },
      update: {
        before: async (data) => {
          const rest = { ...data };
          delete rest.image;
          return { data: rest };
        },
      },
    },
    session: {
      create: {
        // A deleted account can't sign in, with a password or after a reset.
        async before(session) {
          if (await isDeleted(session.userId)) {
            throw new APIError("FORBIDDEN", {
              message: "This account has been deleted. Ask the owner if you think this is a mistake.",
            });
          }
        },
      },
    },
  },
  plugins: [
    username({ minUsernameLength: 3, maxUsernameLength: 30 }),
    // Must stay last so auth calls from Server Actions can set cookies.
    nextCookies(),
  ],
});

async function isDeleted(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { deletedAt: true } });
  return !!user?.deletedAt;
}

export type AuthSession = typeof auth.$Infer.Session;
