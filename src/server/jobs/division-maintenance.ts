import { getBoss } from "@/server/jobs/boss";
import { QUEUES } from "@/server/jobs/queues";
import { runDivisionMaintenance } from "@/server/services/division-maintenance-service";

export async function registerDivisionMaintenanceWorker() {
  const boss = await getBoss();
  await boss.work(QUEUES.divisionMaintenance, async () => {
    await runDivisionMaintenance();
  });
}
