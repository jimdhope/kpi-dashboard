import { podRepository } from "@/server/repositories/pod-repository";
import { requireAdminUser } from "@/server/services/authorization";
import { authService } from "@/server/services/auth-service";

export const podService = {
  async listPods() {
    await authService.requireCurrentUser(); // Any authenticated user can view
    return podRepository.list();
  },

  async createPod(input: {
    campaignId?: string | null;
    incomingWebhookId?: string | null;
    outgoingWebhookId?: string | null;
    name: string;
    description?: string | null;
  }) {
    await requireAdminUser();
    return podRepository.create(input);
  },

  async updatePod(id: string, input: {
    campaignId?: string | null;
    incomingWebhookId?: string | null;
    outgoingWebhookId?: string | null;
    name: string;
    description?: string | null;
  }) {
    await requireAdminUser();
    return podRepository.update(id, input);
  },

  async updateMemberships(id: string, userIds: string[]) {
    await requireAdminUser();
    return podRepository.replaceMemberships(id, userIds);
  },

  async deletePod(id: string) {
    await requireAdminUser();
    return podRepository.delete(id);
  },
};
