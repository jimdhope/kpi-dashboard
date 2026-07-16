import { AppUser, SessionPayload } from "@/lib/contracts";
import { cache } from "react";
import { headers } from "next/headers";
import { cookies } from "next/headers";
import { auth } from "@/server/auth/better-auth";
import { ADMIN_PREVIEW_COOKIE, verifyAdminPreviewToken } from "@/server/auth/admin-preview-token";
import { userRepository } from "@/server/repositories/user-repository";
import { permissionService } from "@/server/services/permission-service";

function mapSessionPayload(user: AppUser | null, expiresAt: Date | null): SessionPayload {
  return {
    authenticated: Boolean(user),
    user,
    expiresAt: expiresAt?.toISOString() ?? null,
    preview: null,
  };
}

const readActualSession = cache(async (): Promise<SessionPayload> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return mapSessionPayload(null, null);
  }
  const user = await userRepository.findById(session.user.id);
  if (!user) {
    return mapSessionPayload(null, null);
  }
  return mapSessionPayload(userRepository.mapUser(user), session.session.expiresAt);
});

const readCurrentSession = cache(async (): Promise<SessionPayload> => {
  const actualSession = await readActualSession();
  if (!actualSession.user) return actualSession;

  const token = verifyAdminPreviewToken((await cookies()).get(ADMIN_PREVIEW_COOKIE)?.value);
  if (!token || token.actorId !== actualSession.user.id) return actualSession;
  if (!(await permissionService.hasEffectiveAdminAccess(actualSession.user.roles))) return actualSession;

  const targetRecord = await userRepository.findById(token.targetId);
  if (!targetRecord) return actualSession;
  const target = { ...userRepository.mapUser(targetRecord), mustChangePassword: false };

  return {
    authenticated: true,
    user: target,
    expiresAt: actualSession.expiresAt,
    preview: {
      active: true,
      actor: {
        id: actualSession.user.id,
        name: actualSession.user.name,
        email: actualSession.user.email,
      },
      target: { id: target.id, name: target.name, email: target.email },
      expiresAt: new Date(token.expiresAt * 1000).toISOString(),
    },
  };
});

export const authService = {
  async getActualSession(): Promise<SessionPayload> {
    return readActualSession();
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

  async requireActualUser() {
    const session = await authService.getActualSession();
    if (!session.user) throw new Error("Unauthorized");
    return session.user;
  },

  async requireActualAdmin() {
    const user = await authService.requireActualUser();
    if (!(await permissionService.hasEffectiveAdminAccess(user.roles))) throw new Error("Forbidden");
    return user;
  },

  async requireAdmin() {
    const user = await authService.requireCurrentUser();
    const isAdmin = await permissionService.hasEffectiveAdminAccess(user.roles);
    if (!isAdmin) {
      throw new Error("Forbidden");
    }
    return user;
  },

};
