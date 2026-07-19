-- Preserve the legacy display/audit context while DailyAchievement is the
-- migration source. The fields remain nullable for any historic source that
-- did not retain this information.
ALTER TABLE "ScoreEvent" ADD COLUMN "ruleName" TEXT;
ALTER TABLE "ScoreEvent" ADD COLUMN "recordedAt" TIMESTAMP(3);

UPDATE "ScoreEvent" AS event
SET
  "ruleName" = achievement."ruleName",
  "recordedAt" = achievement."loggedAt"
FROM "DailyAchievement" AS achievement
WHERE event."externalReference" = 'DailyAchievement:' || achievement."id";

CREATE INDEX "ScoreEvent_competitionId_recordedAt_idx" ON "ScoreEvent"("competitionId", "recordedAt");
