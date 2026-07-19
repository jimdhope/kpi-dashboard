import "server-only";

import { prisma } from "@/server/db/client";
import { resolveOrganizationScope } from "@/server/security/organization-scope-policy";
import { permissionService } from "@/server/services/permission-service";

type ScopedUser = { id: string; roles: string[] };
export type OrganizationScopeResource = "people" | "competitions";

export async function getManagedPodIds(user: ScopedUser, resource: OrganizationScopeResource): Promise<string[] | null> {
  const scopes = await permissionService.getDataScopesForRoles(user.roles);
  const scope = resolveOrganizationScope(scopes[resource]);
  if (scope === "none") throw new Error("Forbidden");
  if (scope === "global") return null;
  const pods = await prisma.pod.findMany({
    where: { OR: [{ podManagerId: user.id }, { teamLeaderId: user.id }] },
    select: { id: true },
  });
  return pods.map((pod) => pod.id);
}

export async function requireManagedPod(user: ScopedUser, podId: string, resource: OrganizationScopeResource) {
  const managedPodIds = await getManagedPodIds(user, resource);
  if (managedPodIds && !managedPodIds.includes(podId)) throw new Error("Forbidden");
}

export async function requireManagedUser(user: ScopedUser, targetUserId: string, resource: OrganizationScopeResource = "people") {
  const managedPodIds = await getManagedPodIds(user, resource);
  if (!managedPodIds) return;
  const sharedPod = await prisma.podMembership.count({
    where: { userId: targetUserId, podId: { in: managedPodIds } },
  });
  if (!sharedPod) throw new Error("Forbidden");
}
