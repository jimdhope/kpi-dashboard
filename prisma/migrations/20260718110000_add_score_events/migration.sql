-- Additive canonical scoring ledger. Legacy scoring tables remain untouched
-- until data migration, reconciliation, and retention requirements are met.
CREATE TABLE "ScoreEvent" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "subjectAgentId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "scoredForDate" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "recordedById" TEXT,
    "idempotencyKey" TEXT,
    "externalReference" TEXT,
    "correctionOfId" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScoreEvent_idempotencyKey_key" ON "ScoreEvent"("idempotencyKey");
CREATE INDEX "ScoreEvent_competitionId_scoredForDate_idx" ON "ScoreEvent"("competitionId", "scoredForDate");
CREATE INDEX "ScoreEvent_competitionId_subjectAgentId_idx" ON "ScoreEvent"("competitionId", "subjectAgentId");
CREATE INDEX "ScoreEvent_subjectAgentId_scoredForDate_idx" ON "ScoreEvent"("subjectAgentId", "scoredForDate");
CREATE INDEX "ScoreEvent_ruleId_scoredForDate_idx" ON "ScoreEvent"("ruleId", "scoredForDate");
CREATE INDEX "ScoreEvent_correctionOfId_idx" ON "ScoreEvent"("correctionOfId");
CREATE INDEX "ScoreEvent_externalReference_idx" ON "ScoreEvent"("externalReference");
