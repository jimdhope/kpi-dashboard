import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";
import { prisma } from "@/server/db/client";
import { requireManagedPod } from "@/server/services/organization-scope-service";

export async function requireCompetitionEditor() {
  const currentUser = await authService.requireCurrentUser();
  const canManage = await permissionService.hasResourceAccess(currentUser.roles, "nav.competitions.manage", "MANAGE");
  if (!canManage) {
    throw new Error("Forbidden");
  }
  return currentUser;
}

export async function requireCompetitionScoreLogger(scope?: { competitionId: string; podId: string }) {
  const user = await requireResourceAccess("nav.competitions.log", "MANAGE");
  if (scope) {
    const competition = await prisma.competition.findUnique({ where: { id: scope.competitionId }, select: { podIds: true } });
    if (!competition || !competition.podIds.includes(scope.podId)) throw new Error("Forbidden");
    await requireManagedPod(user, scope.podId, "competitions");
  }
  return user;
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
