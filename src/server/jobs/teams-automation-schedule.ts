import { getBoss } from "@/server/jobs/boss";
import { QUEUES } from "@/server/jobs/queues";
import { teamsAutomationService } from "@/server/services/teams-automation-service";

export async function registerTeamsAutomationScheduleWorker() {
  const boss = await getBoss();
  await boss.work(QUEUES.teamsAutomationSchedule, async () => {
    await teamsAutomationService.processScheduledAutomations();
  });
}
