import { hasAdminAccess, isCompetitionEditor } from "@/lib/contracts";
import { authService } from "@/server/services/auth-service";

export async function requireAdminUser() {
  const currentUser = await authService.requireCurrentUser();
  if (!hasAdminAccess(currentUser.roles)) {
    throw new Error("Forbidden");
  }
  return currentUser;
}

export async function requireCompetitionEditor() {
  const currentUser = await authService.requireCurrentUser();
  if (!isCompetitionEditor(currentUser.roles)) {
    throw new Error("Forbidden");
  }
  return currentUser;
}
