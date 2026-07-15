import { AppUser, SessionPayload } from "@/lib/contracts";
import { cache } from "react";
import { SESSION_DURATION_DAYS } from "@/server/auth/config";
import {
  clearSessionCookie,
  generateSessionToken,
  getSessionTokenFromCookie,
  hashSessionToken,
  setSessionCookie,
} from "@/server/auth/session-cookie";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { passwordResetRepository } from "@/server/repositories/password-reset-repository";
import { sessionRepository } from "@/server/repositories/session-repository";
import { userRepository } from "@/server/repositories/user-repository";
import { permissionService } from "@/server/services/permission-service";
import { emailService } from "@/server/services/email-service";

function addDays(days: number): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt;
}

function mapSessionPayload(user: AppUser | null, expiresAt: Date | null): SessionPayload {
  return {
    authenticated: Boolean(user),
    user,
    expiresAt: expiresAt?.toISOString() ?? null,
  };
}

async function replaceUserSessions(userId: string): Promise<void> {
  await sessionRepository.deleteByUserId(userId);
  const sessionToken = generateSessionToken();
  const expiresAt = addDays(SESSION_DURATION_DAYS);
  await sessionRepository.create({
    userId,
    sessionTokenHash: hashSessionToken(sessionToken),
    expiresAt,
  });
  await setSessionCookie(sessionToken, expiresAt);
}

const readCurrentSession = cache(async (): Promise<SessionPayload> => {
  const token = await getSessionTokenFromCookie();
  if (!token) {
    return mapSessionPayload(null, null);
  }

  const session = await sessionRepository.findByTokenHash(hashSessionToken(token));
  if (!session || session.expiresAt <= new Date()) {
    // Reading a session can happen during Server Component rendering, where
    // mutating cookies is not allowed. Expired cookies are ignored and are
    // removed by logout or the next successful authentication response.
    return mapSessionPayload(null, null);
  }

  return mapSessionPayload(userRepository.mapUser(session.user), session.expiresAt);
});

export const authService = {
  async login(email: string, password: string) {
    const user = await userRepository.findByEmail(email);

    if (!user) {
      throw new Error("Invalid email or password.");
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new Error("Invalid email or password.");
    }

    await sessionRepository.deleteExpired();

    const sessionToken = generateSessionToken();
    const expiresAt = addDays(SESSION_DURATION_DAYS);

    await sessionRepository.create({
      userId: user.id,
      sessionTokenHash: hashSessionToken(sessionToken),
      expiresAt,
    });

    await setSessionCookie(sessionToken, expiresAt);

    return {
      sessionToken,
      expiresAt,
      user: userRepository.mapUser(user),
    };
  },

  async logout() {
    const token = await getSessionTokenFromCookie();
    if (token) {
      await sessionRepository.deleteByTokenHash(hashSessionToken(token));
    }
    await clearSessionCookie();
  },

  async getCurrentSession(): Promise<SessionPayload> {
    return readCurrentSession();
  },

  async requireCurrentUser() {
    const session = await authService.getCurrentSession();
    if (!session.user) {
      throw new Error("Unauthorized");
    }
    return session.user;
  },

  async requireAdmin() {
    const user = await authService.requireCurrentUser();
    const isAdmin = await permissionService.hasEffectiveAdminAccess(user.roles);
    if (!isAdmin) {
      throw new Error("Forbidden");
    }
    return user;
  },

  async forgotPassword(email: string) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      return;
    }
    await passwordResetRepository.deleteExpired();
    const token = await passwordResetRepository.create(user.id);
    const publicUrl = process.env.PUBLIC_URL ?? "http://localhost:9103";
    const resetUrl = `${publicUrl}/reset-password?token=${token}`;
    try {
      await emailService.sendPasswordResetEmail(email, resetUrl);
    } catch {
      console.warn(`Failed to send password reset email to ${email}`);
    }
  },

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = passwordResetRepository.hashToken(token);
    const resetToken = await passwordResetRepository.findValid(tokenHash);
    if (!resetToken) {
      throw new Error("Invalid or expired reset token.");
    }
    await userRepository.updatePassword(resetToken.userId, await hashPassword(newPassword));
    await passwordResetRepository.consume(resetToken.id);
    await sessionRepository.deleteByUserId(resetToken.userId);
  },

  async changePassword(userId: string, currentPassword: string, nextPassword: string) {
    const passwordHash = await userRepository.findPasswordHashById(userId);
    if (!passwordHash) {
      throw new Error("User not found.");
    }

    const valid = await verifyPassword(currentPassword, passwordHash);
    if (!valid) {
      throw new Error("Current password is incorrect.");
    }

    await userRepository.updatePassword(userId, await hashPassword(nextPassword));
    await replaceUserSessions(userId);
  },
};
