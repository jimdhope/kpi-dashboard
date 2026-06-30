import { getBoss } from "@/server/jobs/boss";
import { QUEUES } from "@/server/jobs/queues";
import { gamificationService } from "@/server/services/gamification-service";

export async function registerGamificationEvaluationWorker() {
  const boss = await getBoss();

  await boss.work(QUEUES.gamificationEvaluation, async () => {
    try {
      const summaries = await gamificationService.retroactivelyEvaluateAll();
      console.log(`[gamification-evaluation] Evaluated ${summaries.length} competitions`);

      const now = new Date();
      const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

      try {
        const result = await gamificationService.crownMonthlyChampion(prevYear, prevMonth);
        console.log(`[gamification-evaluation] Crowned champion: ${result.champion}`);
      } catch (err) {
        if (err instanceof Error && err.message === "No participants found for this month") {
          console.log("[gamification-evaluation] No participants to crown this month");
        } else {
          console.error("[gamification-evaluation] Crown champion error:", err);
        }
      }
    } catch (err) {
      console.error("[gamification-evaluation] Error:", err);
    }
  });
}
