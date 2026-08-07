import { getBoss } from "@/server/jobs/boss";
import { QUEUES } from "@/server/jobs/queues";
import { deleteExpiredQuizShowRooms } from "@/server/services/quiz-show-cleanup-service";

export async function registerQuizShowCleanupWorker() {
  const boss = await getBoss();
  await boss.work(QUEUES.quizShowCleanup, async () => {
    const deletedCount = await deleteExpiredQuizShowRooms();
    console.log(`[quiz-show-cleanup] Deleted ${deletedCount} expired rooms`);
  });
}
