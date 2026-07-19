import "server-only";

import { prisma } from "@/server/db/client";

type SourceTotals = {
  dailyAchievementPoints: number;
  competitionEntryScore: number;
  competitionScoreLogValue: number;
  activeScoreEventPoints: number;
  teamBonusPoints: number;
};

export type ScoreReconciliationReport = {
  generatedAt: string;
  competitionCount: number;
  totals: SourceTotals;
  competitions: Array<{
    id: string;
    name: string;
    isDraft: boolean;
    totals: SourceTotals;
    entryLogMismatches: Array<{
      entryId: string;
      userId: string | null;
      entryScore: number;
      scoreLogValue: number;
    }>;
    agentComparisons: Array<{
      agentId: string;
      dailyAchievementPoints: number;
      competitionEntryScore: number;
      activeScoreEventPoints: number;
    }>;
  }>;
};

function sourceTotals(): SourceTotals {
  return {
    dailyAchievementPoints: 0,
    competitionEntryScore: 0,
    competitionScoreLogValue: 0,
    activeScoreEventPoints: 0,
    teamBonusPoints: 0,
  };
}

function sumByKey<T>(rows: T[], keyOf: (row: T) => string, valueOf: (row: T) => number) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = keyOf(row);
    totals.set(key, (totals.get(key) ?? 0) + valueOf(row));
  }
  return totals;
}

/**
 * Read-only comparison of the current parallel score stores. It intentionally
 * does not claim that the stores must match: DailyAchievement records points,
 * while some legacy flows record raw entry increments. The report makes each
 * difference explicit for migration review.
 */
export const scoreReconciliationService = {
  async createReport(input?: { competitionIds?: string[] }): Promise<ScoreReconciliationReport> {
    const competitionWhere = input?.competitionIds?.length
      ? { id: { in: input.competitionIds } }
      : undefined;
    const competitionIdWhere = input?.competitionIds?.length
      ? { competitionId: { in: input.competitionIds } }
      : undefined;

    const [competitions, dailyAchievements, entries, scoreLogs, activeEvents, teamBonuses] = await Promise.all([
      prisma.competition.findMany({
        where: competitionWhere,
        select: { id: true, name: true, isDraft: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.dailyAchievement.groupBy({
        by: ["competitionId", "agentId"],
        where: competitionIdWhere,
        _sum: { points: true },
      }),
      prisma.competitionEntry.findMany({
        where: competitionIdWhere,
        select: { id: true, competitionId: true, userId: true, score: true },
      }),
      prisma.competitionScoreLog.groupBy({
        by: ["entryId"],
        _sum: { value: true },
      }),
      prisma.scoreEvent.groupBy({
        by: ["competitionId", "subjectAgentId"],
        where: {
          voidedAt: null,
          ...(competitionIdWhere ?? {}),
        },
        _sum: { points: true },
      }),
      prisma.teamBonusLog.groupBy({
        by: ["competitionId"],
        where: competitionIdWhere,
        _sum: { points: true },
      }),
    ]);

    const logTotalsByEntryId = new Map(scoreLogs.map((row) => [row.entryId, row._sum.value ?? 0]));
    const dailyByCompetitionAgent = sumByKey(
      dailyAchievements,
      (row) => `${row.competitionId}:${row.agentId}`,
      (row) => row._sum.points ?? 0,
    );
    const entryByCompetitionAgent = sumByKey(
      entries.filter((entry) => entry.userId !== null),
      (entry) => `${entry.competitionId}:${entry.userId}`,
      (entry) => entry.score,
    );
    const eventByCompetitionAgent = sumByKey(
      activeEvents,
      (row) => `${row.competitionId}:${row.subjectAgentId}`,
      (row) => row._sum.points ?? 0,
    );
    const teamBonusByCompetition = new Map(teamBonuses.map((row) => [row.competitionId, row._sum.points ?? 0]));

    const reportTotals = sourceTotals();
    const competitionReports = competitions.map((competition) => {
      const totals = sourceTotals();
      const agentKeys = new Set<string>();

      for (const [key, value] of dailyByCompetitionAgent) {
        if (!key.startsWith(`${competition.id}:`)) continue;
        totals.dailyAchievementPoints += value;
        agentKeys.add(key);
      }
      for (const [key, value] of entryByCompetitionAgent) {
        if (!key.startsWith(`${competition.id}:`)) continue;
        totals.competitionEntryScore += value;
        agentKeys.add(key);
      }
      for (const [key, value] of eventByCompetitionAgent) {
        if (!key.startsWith(`${competition.id}:`)) continue;
        totals.activeScoreEventPoints += value;
        agentKeys.add(key);
      }

      const competitionEntries = entries.filter((entry) => entry.competitionId === competition.id);
      const entryLogMismatches = competitionEntries
        .map((entry) => {
          const scoreLogValue = logTotalsByEntryId.get(entry.id) ?? 0;
          totals.competitionScoreLogValue += scoreLogValue;
          return {
            entryId: entry.id,
            userId: entry.userId,
            entryScore: entry.score,
            scoreLogValue,
          };
        })
        .filter((entry) => entry.entryScore !== entry.scoreLogValue);

      totals.teamBonusPoints = teamBonusByCompetition.get(competition.id) ?? 0;
      for (const key of Object.keys(reportTotals) as Array<keyof SourceTotals>) {
        reportTotals[key] += totals[key];
      }

      return {
        ...competition,
        totals,
        entryLogMismatches,
        agentComparisons: [...agentKeys]
          .map((key) => ({
            agentId: key.slice(competition.id.length + 1),
            dailyAchievementPoints: dailyByCompetitionAgent.get(key) ?? 0,
            competitionEntryScore: entryByCompetitionAgent.get(key) ?? 0,
            activeScoreEventPoints: eventByCompetitionAgent.get(key) ?? 0,
          }))
          .sort((a, b) => a.agentId.localeCompare(b.agentId)),
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      competitionCount: competitionReports.length,
      totals: reportTotals,
      competitions: competitionReports,
    };
  },
};
