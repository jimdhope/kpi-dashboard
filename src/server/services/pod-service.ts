import { podRepository } from "@/server/repositories/pod-repository";
import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";
import { prisma } from "@/server/db/client";
import { getManagedPodIds, requireManagedPod } from "@/server/services/organization-scope-service";

async function requirePodPermission(level: "VIEW" | "MANAGE") {
  const user = await authService.requireCurrentUser();
  if (!(await permissionService.hasResourceAccess(user.roles, "nav.settings.pods", level))) throw new Error("Forbidden");
  return user;
}

export const podService = {
  async listPods() {
    const currentUser = await authService.requireCurrentUser();
    const managedPodIds = await getManagedPodIds(currentUser, "people");
    if (managedPodIds === null) return podRepository.list();
    const visiblePodIds = managedPodIds.length === 0 ? currentUser.podIds ?? [] : managedPodIds;
    const pods = await podRepository.listForUser(currentUser.id);
    return pods.filter((pod) => visiblePodIds.includes(pod.id));
  },

  async createPod(input: {
    campaignId?: string | null;
    incomingWebhookId?: string | null;
    outgoingWebhookId?: string | null;
    teamLeaderId?: string | null;
    podManagerId?: string | null;
    name: string;
    description?: string | null;
  }) {
    const user = await requirePodPermission("MANAGE");
    if (await getManagedPodIds(user, "people") !== null) throw new Error("Forbidden");
    return podRepository.create(input);
  },

  async updatePod(id: string, input: {
    campaignId?: string | null;
    incomingWebhookId?: string | null;
    outgoingWebhookId?: string | null;
    teamLeaderId?: string | null;
    podManagerId?: string | null;
    name: string;
    description?: string | null;
  }) {
    const user = await requirePodPermission("MANAGE");
    await requireManagedPod(user, id, "people");
    return podRepository.update(id, input);
  },

  async updateMemberships(id: string, userIds: string[]) {
    const currentUser = await authService.requireCurrentUser();
    const canManageAllPods = await permissionService.hasResourceAccess(currentUser.roles, "nav.settings.pods", "MANAGE");
    if (!canManageAllPods) {
      const canManageUsers = await permissionService.hasResourceAccess(currentUser.roles, "nav.settings.users", "MANAGE");
      const assigned = await prisma.pod.count({
        where: {
          id,
          OR: [{ podManagerId: currentUser.id }, { teamLeaderId: currentUser.id }],
        },
      });
      if (!canManageUsers || !assigned) throw new Error("Forbidden");
    }
    await requireManagedPod(currentUser, id, "people");
    return podRepository.replaceMemberships(id, userIds);
  },

  async deletePod(id: string) {
    const user = await authService.requireCurrentUser();
    if (!(await permissionService.hasResourceAccess(user.roles, "nav.settings.podDeletion", "MANAGE"))) throw new Error("Forbidden");
    await requireManagedPod(user, id, "people");
    return podRepository.delete(id);
  },
};
