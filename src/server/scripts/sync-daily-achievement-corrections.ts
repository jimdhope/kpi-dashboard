import "server-only";
import { scoreEventMigrationService } from "@/server/services/score-event-migration-service";

const apply = process.argv.includes("--apply");
console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...(await scoreEventMigrationService.syncDailyAchievementCorrections({ apply })) }, null, 2));
