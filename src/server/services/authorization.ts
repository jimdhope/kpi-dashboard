import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";

export async function requireAdminUser() {
  const currentUser = await authService.requireCurrentUser();
  if (!currentUser.roles.includes("admin")) {
    throw new Error("Forbidden");
  }
  return currentUser;
}

export async function requireCompetitionEditor() {
  const currentUser = await authService.requireCurrentUser();
  const canManage = await permissionService.hasResourceAccess(currentUser.roles, "nav.competitions.manage", "MANAGE");
  if (!canManage) {
    throw new Error("Forbidden");
  }
  return currentUser;
}

export async function requireCompetitionScoreLogger() {
  return requireResourceAccess("nav.competitions.log", "MANAGE");
}

export async function requireResourceAccess(resource: string, level: "VIEW" | "MANAGE" = "MANAGE") {
  const currentUser = await authService.requireCurrentUser();
  if (!(await permissionService.hasResourceAccess(currentUser.roles, resource, level))) throw new Error("Forbidden");
  return currentUser;
}

export async function requireAnyResourceAccess(resources: string[], level: "VIEW" | "MANAGE" = "MANAGE") {
  const currentUser = await authService.requireCurrentUser();
  for (const resource of resources) {
    if (await permissionService.hasResourceAccess(currentUser.roles, resource, level)) return currentUser;
  }
  throw new Error("Forbidden");
}
