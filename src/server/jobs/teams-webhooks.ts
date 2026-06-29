import { getBoss } from "@/server/jobs/boss";
import { QUEUES } from "@/server/jobs/queues";
import { sendTeamsWebhook } from "@/server/integrations/teams/adapter";

export interface TeamsWebhookJobPayload {
  webhookId: string;
  webhookName: string;
  url: string;
  title: string;
  text: string;
  facts?: Array<{ name: string; value: string }>;
  rawPayload?: Record<string, unknown>;
}

export async function enqueueTeamsWebhookJobs(payloads: TeamsWebhookJobPayload[]) {
  if (payloads.length === 0) {
    return;
  }

  const boss = await getBoss();
  await Promise.all(
    payloads.map((payload) =>
      boss.send(QUEUES.teamsWebhookDelivery, payload, {
        retryLimit: 5,
      }),
    ),
  );
}

export async function registerTeamsWebhookWorker() {
  const boss = await getBoss();
  await boss.work<TeamsWebhookJobPayload>(QUEUES.teamsWebhookDelivery, async (jobs) => {
    await Promise.all(
      jobs.map((job) =>
        sendTeamsWebhook(job.data.url, {
          title: job.data.title,
          text: job.data.text,
          facts: job.data.facts,
          rawPayload: job.data.rawPayload,
        }),
      ),
    );
  });
}
