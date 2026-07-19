ALTER TABLE "Competition" ADD COLUMN "autoTeamsUpdates" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Competition" ADD COLUMN "lastAutoTeamsScoreAt" TIMESTAMP(3);
ALTER TABLE "Competition" ADD COLUMN "lastAutoTeamsSentAt" TIMESTAMP(3);
