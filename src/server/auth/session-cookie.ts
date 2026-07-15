import crypto from "crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, getSessionCookieSecret } from "@/server/auth/config";

function signSessionToken(token: string): string {
  return crypto.createHmac("sha256", getSessionCookieSecret()).update(token).digest("hex");
}

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  const signedValue = `${token}.${signSessionToken(token)}`;

  // Production cookies are secure by default. Local production-mode HTTP testing can
  // opt out explicitly without coupling cookie security to one of several URL vars.
  const secure = process.env.NODE_ENV === "production"
    && process.env.ALLOW_INSECURE_COOKIES !== "true";

  cookieStore.set(SESSION_COOKIE_NAME, signedValue, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const rawValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!rawValue) {
    return null;
  }

  const [token, signature] = rawValue.split(".");
  if (!token || !signature) {
    return null;
  }

  const expected = signSessionToken(token);
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");

  if (expectedBuffer.length !== signatureBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return null;
  }

  return token;
}
