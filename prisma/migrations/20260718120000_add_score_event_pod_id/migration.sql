-- Preserve the historical pod context required by scoped standings. Existing
-- opening-balance events are mapped back to their DailyAchievement source.
ALTER TABLE "ScoreEvent" ADD COLUMN "podId" TEXT;

UPDATE "ScoreEvent" AS event
SET "podId" = achievement."podId"
FROM "DailyAchievement" AS achievement
WHERE event."externalReference" = 'DailyAchievement:' || achievement."id"
  AND event."podId" IS NULL;

ALTER TABLE "ScoreEvent" ALTER COLUMN "podId" SET NOT NULL;
CREATE INDEX "ScoreEvent_competitionId_podId_idx" ON "ScoreEvent"("competitionId", "podId");
