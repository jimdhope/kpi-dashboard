import { registerTeamsAutomationScheduleWorker } from "@/server/jobs/teams-automation-schedule";
import { registerTeamsWebhookWorker } from "@/server/jobs/teams-webhooks";
import { getBoss } from "@/server/jobs/boss";

async function main() {
  await registerTeamsWebhookWorker();
  await registerTeamsAutomationScheduleWorker();
  // Keep the process alive for pg-boss workers.
  await new Promise(() => undefined);
}

async function shutdown() {
  try {
    const boss = await getBoss();
    await boss.stop();
  } finally {
    process.exit(0);
  }
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
