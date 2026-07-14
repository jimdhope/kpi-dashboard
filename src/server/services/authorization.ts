import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";

export async function requireAdminUser() {
  const currentUser = await authService.requireCurrentUser();
  const isAdmin = await permissionService.hasEffectiveAdminAccess(currentUser.roles);
  if (!isAdmin) {
    throw new Error("Forbidden");
  }
  return currentUser;
}

export async function requireCompetitionEditor() {
  const currentUser = await authService.requireCurrentUser();
  const canManage = await permissionService.hasNavAccess(currentUser.roles, "competitions", "MANAGE");
  if (!canManage) {
    throw new Error("Forbidden");
  }
  return currentUser;
}
