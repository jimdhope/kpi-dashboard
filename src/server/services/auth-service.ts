import { AppUser, SessionPayload } from "@/lib/contracts";
import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/server/auth/better-auth";
import { userRepository } from "@/server/repositories/user-repository";
import { permissionService } from "@/server/services/permission-service";

function mapSessionPayload(user: AppUser | null, expiresAt: Date | null): SessionPayload {
  return {
    authenticated: Boolean(user),
    user,
    expiresAt: expiresAt?.toISOString() ?? null,
  };
}

const readCurrentSession = cache(async (): Promise<SessionPayload> => {
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

export const authService = {
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

};
