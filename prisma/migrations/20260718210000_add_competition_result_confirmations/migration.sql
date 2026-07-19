CREATE TABLE "CompetitionResultConfirmation" (
  "id" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "confirmedById" TEXT NOT NULL,
  "note" TEXT,
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompetitionResultConfirmation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompetitionResultConfirmation_competitionId_key" ON "CompetitionResultConfirmation"("competitionId");
CREATE INDEX "CompetitionResultConfirmation_confirmedAt_idx" ON "CompetitionResultConfirmation"("confirmedAt");
ALTER TABLE "CompetitionResultConfirmation" ADD CONSTRAINT "CompetitionResultConfirmation_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
