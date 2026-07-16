import { TeamsChannelCategory, TeamsWebhookDirection } from "@/lib/contracts";
import { teamsWebhookRepository } from "@/server/repositories/teams-webhook-repository";
import { requireResourceAccess } from "@/server/services/authorization";

function isValidCuid(id: string): boolean {
  return /^c[a-z0-9]{24}$/.test(id);
}

function isUrlCorrupted(id: string, url: string): boolean {
  return id === url || url.includes(id);
}

export const teamsWebhookService = {
  async listWebhooks() {
    await requireResourceAccess("nav.integrations.channels");
    const webhooks = await teamsWebhookRepository.list();
    
    for (const webhook of webhooks) {
      if (!isValidCuid(webhook.id) || isUrlCorrupted(webhook.id, webhook.url)) {
        console.error(`[TeamsWebhookService] Corrupted webhook detected: id=${webhook.id}, name=${webhook.name}`);
      }
    }
    
    return webhooks;
  },

  async createWebhook(input: {
    name: string;
    friendlyName?: string | null;
    direction: TeamsWebhookDirection;
    url: string;
    description?: string | null;
    category?: TeamsChannelCategory | null;
    isActive: boolean;
  }) {
    await requireResourceAccess("nav.integrations.channels");
    
    if (input.url.length > 2000) {
      throw new Error("Webhook URL is too long");
    }
    
    return teamsWebhookRepository.create(input);
  },

  async updateWebhook(
    id: string,
    input: {
      name: string;
      friendlyName?: string | null;
      direction: TeamsWebhookDirection;
      url: string;
      description?: string | null;
      category?: TeamsChannelCategory | null;
      isActive: boolean;
    },
  ) {
    await requireResourceAccess("nav.integrations.channels");
    
    if (!isValidCuid(id)) {
      console.error(`[TeamsWebhookService] Invalid webhook ID format: ${id}`);
      throw new Error("Invalid webhook ID format");
    }
    
    if (input.url.length > 2000) {
      throw new Error("Webhook URL is too long");
    }
    
    return teamsWebhookRepository.update(id, input);
  },

  async testConnection(id: string) {
    await requireResourceAccess("nav.integrations.channels");
    
    if (!isValidCuid(id)) {
      console.error(`[TeamsWebhookService] Invalid webhook ID format for test: ${id}`);
      throw new Error("Invalid webhook ID format");
    }
    
    const webhook = await teamsWebhookRepository.findById(id);
    if (!webhook) {
      throw new Error("Webhook not found");
    }
    
    if (isUrlCorrupted(webhook.id, webhook.url)) {
      console.error(`[TeamsWebhookService] Corrupted webhook detected during test: id=${webhook.id}`);
      throw new Error("Webhook data is corrupted - please recreate this webhook");
    }

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: "message",
          attachments: [{
            contentType: "application/vnd.microsoft.card.adaptive",
            contentUrl: null,
            content: {
              $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
              type: "AdaptiveCard",
              version: "1.4",
              body: [{
                type: "TextBlock",
                text: "KPI Quest test message"
              }]
            }
          }]
        })
      });

      const success = response.ok || response.status === 200;
      
      await teamsWebhookRepository.updateTestStatus(id, success ? "success" : "failed");
      
      return { success };
    } catch (error) {
      await teamsWebhookRepository.updateTestStatus(id, "failed");
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  },

  async deleteWebhook(id: string) {
    await requireResourceAccess("nav.integrations.channels");
    
    if (!isValidCuid(id)) {
      console.error(`[TeamsWebhookService] Invalid webhook ID format for delete: ${id}`);
      throw new Error("Invalid webhook ID format");
    }
    
    const webhook = await teamsWebhookRepository.findById(id);
    if (!webhook) {
      throw new Error("Not found");
    }
    
    if (isUrlCorrupted(webhook.id, webhook.url)) {
      console.warn(`[TeamsWebhookService] Deleting corrupted webhook: id=${webhook.id}, name=${webhook.name}`);
    }
    
    await teamsWebhookRepository.delete(id);
  },
};
