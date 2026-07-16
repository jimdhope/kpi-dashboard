import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_PREVIEW_COOKIE = "kpiq_admin_preview";
export const ADMIN_PREVIEW_DURATION_SECONDS = 30 * 60;

export interface AdminPreviewTokenPayload {
  actorId: string;
  targetId: string;
  issuedAt: number;
  expiresAt: number;
}

function getSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET
    ?? (process.env.NODE_ENV !== "production" ? process.env.SESSION_COOKIE_SECRET : undefined);
  if (!secret || secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");
  }
  return secret;
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", getSecret()).update(encodedPayload).digest("base64url");
}

export function createAdminPreviewToken(actorId: string, targetId: string): {
  token: string;
  payload: AdminPreviewTokenPayload;
} {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: AdminPreviewTokenPayload = {
    actorId,
    targetId,
    issuedAt,
    expiresAt: issuedAt + ADMIN_PREVIEW_DURATION_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { token: `${encodedPayload}.${sign(encodedPayload)}`, payload };
}

export function verifyAdminPreviewToken(token: string | undefined): AdminPreviewTokenPayload | null {
  if (!token) return null;
  const [encodedPayload, suppliedSignature, extra] = token.split(".");
  if (!encodedPayload || !suppliedSignature || extra) return null;

  const expectedSignature = sign(encodedPayload);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<AdminPreviewTokenPayload>;
    if (
      typeof parsed.actorId !== "string" ||
      typeof parsed.targetId !== "string" ||
      typeof parsed.issuedAt !== "number" ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= Math.floor(Date.now() / 1000) ||
      parsed.expiresAt <= parsed.issuedAt
    ) {
      return null;
    }
    return parsed as AdminPreviewTokenPayload;
  } catch {
    return null;
  }
}
