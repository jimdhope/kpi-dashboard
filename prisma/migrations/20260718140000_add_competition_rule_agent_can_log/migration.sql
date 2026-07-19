-- Existing competition rules remain manager-only until explicitly enabled.
ALTER TABLE "CompetitionRule"
ADD COLUMN "agentCanLog" BOOLEAN NOT NULL DEFAULT false;
