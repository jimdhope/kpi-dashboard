import { TeamsWebhookDirection } from "@/lib/contracts";
import { teamsWebhookRepository } from "@/server/repositories/teams-webhook-repository";
import { requireAdminUser } from "@/server/services/authorization";

export const teamsWebhookService = {
  async listWebhooks() {
    await requireAdminUser();
    return teamsWebhookRepository.list();
  },

  async createWebhook(input: {
    name: string;
    direction: TeamsWebhookDirection;
    url: string;
    description?: string | null;
    isActive: boolean;
  }) {
    await requireAdminUser();
    return teamsWebhookRepository.create(input);
  },

  async updateWebhook(
    id: string,
    input: {
      name: string;
      direction: TeamsWebhookDirection;
      url: string;
      description?: string | null;
      isActive: boolean;
    },
  ) {
    await requireAdminUser();
    return teamsWebhookRepository.update(id, input);
  },
};
