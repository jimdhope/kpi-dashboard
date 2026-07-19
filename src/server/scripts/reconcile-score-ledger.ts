import "server-only";

import { scoreReconciliationService } from "@/server/services/score-reconciliation-service";

const competitionIds = process.argv
  .filter((argument) => argument.startsWith("--competition="))
  .map((argument) => argument.slice("--competition=".length))
  .filter(Boolean);
const summaryOnly = process.argv.includes("--summary");

const report = await scoreReconciliationService.createReport({ competitionIds });

if (summaryOnly) {
  const dailyAchievementToEventMismatchCount = report.competitions.reduce(
    (total, competition) => total + competition.agentComparisons.filter(
      (agent) => agent.dailyAchievementPoints !== agent.activeScoreEventPoints,
    ).length,
    0,
  );
  console.log(JSON.stringify({
    generatedAt: report.generatedAt,
    competitionCount: report.competitionCount,
    totals: report.totals,
    entryLogMismatchCount: report.competitions.reduce(
      (total, competition) => total + competition.entryLogMismatches.length,
      0,
    ),
    dailyAchievementToEventMismatchCount,
  }, null, 2));
} else {
  console.log(JSON.stringify(report, null, 2));
}
