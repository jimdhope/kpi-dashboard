import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { passkey } from "@better-auth/passkey";
import { prisma } from "@/server/db/client";
import { emailService } from "@/server/services/email-service";

function publicOrigin(): string {
  const value = process.env.BETTER_AUTH_URL ?? process.env.PUBLIC_URL ?? "http://localhost:9103";
  const url = new URL(value);
  const isLocalHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (process.env.NODE_ENV === "production" && !isLocalHost && url.protocol !== "https:") {
    throw new Error("BETTER_AUTH_URL must use HTTPS in production.");
  }
  return url.origin;
}

function authSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET
    ?? (process.env.NODE_ENV !== "production" ? process.env.SESSION_COOKIE_SECRET : undefined);
  if (!secret || secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");
  }
  return secret;
}

const origin = publicOrigin();
const rpID = process.env.PASSKEY_RP_ID ?? new URL(origin).hostname;

export const auth = betterAuth({
  appName: "KPI Quest",
  baseURL: origin,
  secret: authSecret(),
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  trustedOrigins: [origin],
  user: {
    fields: { image: "avatarUrl" },
    additionalFields: {
      mustChangePassword: { type: "boolean", required: true, defaultValue: false, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
    freshAge: 60 * 30,
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      await emailService.sendPasswordResetEmail(user.email, url);
    },
    onPasswordReset: async ({ user }) => {
      await prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: false } });
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "rateLimit",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 15 * 60, max: 10 },
      "/request-password-reset": { window: 60 * 60, max: 5 },
      "/reset-password": { window: 60 * 60, max: 5 },
      "/sign-in/passkey": { window: 60, max: 10 },
    },
  },
  advanced: {
    cookiePrefix: "kpiq",
    useSecureCookies: process.env.NODE_ENV === "production" && process.env.ALLOW_INSECURE_COOKIES !== "true",
  },
  plugins: [
    passkey({
      rpID,
      rpName: "KPI Quest",
      origin,
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
      registration: { requireSession: true },
    }),
  ],
});

export const authOrigin = origin;
export const passkeyRpId = rpID;
