import "server-only";

import { scoreEventMigrationService } from "@/server/services/score-event-migration-service";

const apply = process.argv.includes("--apply");
const result = await scoreEventMigrationService.backfillDailyAchievements({ apply });

console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...result }, null, 2));
