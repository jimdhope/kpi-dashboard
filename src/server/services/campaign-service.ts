import { campaignRepository } from "@/server/repositories/campaign-repository";
import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";

async function requireCampaignManager() {
  const user = await authService.requireCurrentUser();
  if (!(await permissionService.hasResourceAccess(user.roles, "nav.settings.campaigns", "MANAGE"))) throw new Error("Forbidden");
  return user;
}

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
    await requireCampaignManager();
    return campaignRepository.create(input);
  },

  async updateCampaign(id: string, input: {
    name: string;
    description?: string | null;
    isActive: boolean;
    incomingWebhookId?: string | null;
    outgoingWebhookId?: string | null;
  }) {
    await requireCampaignManager();
    return campaignRepository.update(id, input);
  },
};
