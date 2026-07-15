CREATE INDEX "CompetitionEntry_competitionId_score_idx"
  ON "CompetitionEntry"("competitionId", "score");

CREATE INDEX "CompetitionScoreLog_ruleId_entryId_idx"
  ON "CompetitionScoreLog"("ruleId", "entryId");
