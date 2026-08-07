import { getBoss } from "@/server/jobs/boss";
import { QUEUES } from "@/server/jobs/queues";
import { deleteExpiredMemeMatchRooms } from "@/server/services/meme-match-cleanup-service";

export async function registerMemeMatchCleanupWorker() {
  const boss = await getBoss();
  await boss.work(QUEUES.memeMatchCleanup, async () => {
    const deletedCount = await deleteExpiredMemeMatchRooms();
    console.log(`[meme-match-cleanup] Deleted ${deletedCount} expired rooms`);
  });
}
