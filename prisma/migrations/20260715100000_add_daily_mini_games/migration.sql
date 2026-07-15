CREATE TABLE "DailyGameChallenge" (
    "id" TEXT NOT NULL,
    "gameKey" TEXT NOT NULL,
    "challengeDate" TEXT NOT NULL,
    "variant" TEXT NOT NULL DEFAULT 'default',
    "content" JSONB NOT NULL,
    "solution" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyGameChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyGameAttempt" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "score" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "guesses" INTEGER,
    "mistakes" INTEGER NOT NULL DEFAULT 0,
    "hints" INTEGER NOT NULL DEFAULT 0,
    "state" JSONB NOT NULL,
    "metrics" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DailyGameAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyGameChallenge_gameKey_challengeDate_variant_key" ON "DailyGameChallenge"("gameKey", "challengeDate", "variant");
CREATE INDEX "DailyGameChallenge_challengeDate_idx" ON "DailyGameChallenge"("challengeDate");
CREATE UNIQUE INDEX "DailyGameAttempt_challengeId_userId_key" ON "DailyGameAttempt"("challengeId", "userId");
CREATE INDEX "DailyGameAttempt_challengeId_status_score_idx" ON "DailyGameAttempt"("challengeId", "status", "score");
CREATE INDEX "DailyGameAttempt_userId_startedAt_idx" ON "DailyGameAttempt"("userId", "startedAt");

ALTER TABLE "DailyGameAttempt" ADD CONSTRAINT "DailyGameAttempt_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "DailyGameChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyGameAttempt" ADD CONSTRAINT "DailyGameAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
