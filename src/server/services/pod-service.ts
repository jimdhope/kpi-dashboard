import { podRepository } from "@/server/repositories/pod-repository";
import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";
import { prisma } from "@/server/db/client";

async function requirePodPermission(level: "VIEW" | "MANAGE") {
  const user = await authService.requireCurrentUser();
  if (!(await permissionService.hasResourceAccess(user.roles, "nav.settings.pods", level))) throw new Error("Forbidden");
  return user;
}

export const podService = {
  async listPods() {
    const currentUser = await authService.requireCurrentUser();
    const canManagePods = await permissionService.hasResourceAccess(currentUser.roles, "nav.settings.pods", "MANAGE");
    if (currentUser.roles.includes("admin") || canManagePods) {
      return podRepository.list();
    }
    return podRepository.listForUser(currentUser.id);
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
    await requirePodPermission("MANAGE");
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
    await requirePodPermission("MANAGE");
    return podRepository.update(id, input);
  },

  async updateMemberships(id: string, userIds: string[]) {
    const currentUser = await authService.requireCurrentUser();
    const canManageAllPods = await permissionService.hasResourceAccess(currentUser.roles, "nav.settings.pods", "MANAGE");
    if (!canManageAllPods) {
      const canManageUsers = await permissionService.hasResourceAccess(currentUser.roles, "nav.settings.users", "MANAGE");
      const assigned = await prisma.pod.count({ where: { id, podManagerId: currentUser.id } });
      if (!canManageUsers || !assigned) throw new Error("Forbidden");
    }
    return podRepository.replaceMemberships(id, userIds);
  },

  async deletePod(id: string) {
    const user = await authService.requireCurrentUser();
    if (!user.roles.includes("admin")) throw new Error("Forbidden");
    return podRepository.delete(id);
  },
};
