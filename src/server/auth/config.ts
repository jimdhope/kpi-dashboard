export const SESSION_COOKIE_NAME = "kpiq_v3_session";
export const SESSION_DURATION_DAYS = 14;

export function getSessionCookieSecret(): string {
  const secret = process.env.SESSION_COOKIE_SECRET;

  if (!secret) {
    throw new Error("SESSION_COOKIE_SECRET is required.");
  }

  return secret;
}
