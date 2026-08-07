import { PgBoss } from "pg-boss";
import { QUEUES } from "@/server/jobs/queues";

let bossPromise: Promise<PgBoss> | null = null;

export function getBoss(): Promise<PgBoss> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to initialize pg-boss.");
  }

  if (!bossPromise) {
    const boss = new PgBoss({
      connectionString: process.env.DATABASE_URL,
    });

    bossPromise = boss.start().then(async () => {
      const existingQueue = await boss.getQueue(QUEUES.teamsWebhookDelivery);
      if (!existingQueue) {
        await boss.createQueue(QUEUES.teamsWebhookDelivery);
      }

      const existingAutomationQueue = await boss.getQueue(QUEUES.teamsAutomationSchedule);
      if (!existingAutomationQueue) {
        await boss.createQueue(QUEUES.teamsAutomationSchedule);
      }

      const existingEvalQueue = await boss.getQueue(QUEUES.gamificationEvaluation);
      if (!existingEvalQueue) {
        await boss.createQueue(QUEUES.gamificationEvaluation);
      }

      const existingCompetitionTeamsQueue = await boss.getQueue(QUEUES.competitionTeamsAutoUpdate);
      if (!existingCompetitionTeamsQueue) {
        await boss.createQueue(QUEUES.competitionTeamsAutoUpdate);
      }

      const existingMemeMatchCleanupQueue = await boss.getQueue(QUEUES.memeMatchCleanup);
      if (!existingMemeMatchCleanupQueue) {
        await boss.createQueue(QUEUES.memeMatchCleanup);
      }

      const existingQuizShowCleanupQueue = await boss.getQueue(QUEUES.quizShowCleanup);
      if (!existingQuizShowCleanupQueue) {
        await boss.createQueue(QUEUES.quizShowCleanup);
      }

      await boss.schedule(QUEUES.teamsAutomationSchedule, "* * * * *");
      await boss.schedule(QUEUES.gamificationEvaluation, "0 * * * *");
      await boss.schedule(QUEUES.competitionTeamsAutoUpdate, "*/15 * * * *");
      await boss.schedule(QUEUES.memeMatchCleanup, "0 3 * * *");
      await boss.schedule(QUEUES.quizShowCleanup, "0 4 * * *");

      return boss;
    });
  }

  return bossPromise;
}
