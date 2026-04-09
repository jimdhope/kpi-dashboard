import { campaignRepository } from "@/server/repositories/campaign-repository";
import { requireAdminUser } from "@/server/services/authorization";
import { authService } from "@/server/services/auth-service";

export const campaignService = {
  async listCampaigns() {
    await authService.requireCurrentUser(); // Any authenticated user can view
    return campaignRepository.list();
  },

  async createCampaign(input: {
    name: string;
    description?: string | null;
    isActive: boolean;
    incomingWebhookId?: string | null;
    outgoingWebhookId?: string | null;
  }) {
    await requireAdminUser();
    return campaignRepository.create(input);
  },

  async updateCampaign(id: string, input: {
    name: string;
    description?: string | null;
    isActive: boolean;
    incomingWebhookId?: string | null;
    outgoingWebhookId?: string | null;
  }) {
    await requireAdminUser();
    return campaignRepository.update(id, input);
  },
};
