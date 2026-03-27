import { teamsWebhookRepository } from "@/server/repositories/teams-webhook-repository";
import { enqueueTeamsWebhookJobs } from "@/server/jobs/teams-webhooks";

export const teamsEventService = {
  async queueDeliveries(input: {
    webhookIds: string[];
    title: string;
    text: string;
    facts?: Array<{ name: string; value: string }>;
    rawPayload?: Record<string, unknown>;
  }) {
    const webhooks = await teamsWebhookRepository.listActiveByIds(Array.from(new Set(input.webhookIds)));

    await enqueueTeamsWebhookJobs(
      webhooks.map((webhook) => ({
        webhookId: webhook.id,
        webhookName: webhook.name,
        url: webhook.url,
        title: input.title,
        text: input.text,
        facts: input.facts,
        rawPayload: input.rawPayload,
      })),
    );
  },
};
