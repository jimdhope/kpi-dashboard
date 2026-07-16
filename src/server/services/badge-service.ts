import { prisma } from "@/server/db/client";
import type { Prisma } from "@prisma/client";
import { evaluateCriteria, type RuleContext } from "./rule-evaluator";

interface CompetitionResultInfo {
  userId: string;
  agentName: string;
  competitionId: string;
  competitionName: string;
  rank: number;
  totalScore: number;
  wasPresent: boolean;
  previousRank: number | null;
  totalParticipants?: number;
  competitionEndsAt?: Date;
}

interface ExtendedRuleCtx extends RuleContext {
  percentile?: number;
  totalParticipants?: number;
  consecutiveCompetitions?: number;
  attendanceCount?: number;
  attendanceTotal?: number;
  bestSingleScore?: number;
  bestSingleRank?: number;
  previousRanks?: number[];
}

export const badgeService = {
  async checkAndAwardBadges(result: CompetitionResultInfo): Promise<string[]> {
    const awarded: string[] = [];
    const userId = result.userId;
    const recentResults = await prisma.competitionResult.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    let winStreak = 0;
    for (const res of recentResults) {
      if (res.rank === 1) {
        winStreak++;
      } else {
        break;
      }
    }

    const resultCount = await prisma.competitionResult.count({
      where: { userId },
    });

    // Extended context
    const totalParticipants = result.totalParticipants ?? await prisma.competitionResult.count({
      where: { competitionId: result.competitionId },
    });

    const bestSingleScore = recentResults.length > 0 ? Math.max(...recentResults.map(r => r.totalScore)) : 0;
    const bestSingleRank = recentResults.length > 0 ? Math.min(...recentResults.map(r => r.rank)) : 999;

    const previousRanks = recentResults.slice(1).map(r => r.rank);

    const consecutiveCompetitions = recentResults.length;

    const attendanceRecent = await prisma.competitionResult.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { wasPresent: true },
    });
    const attendanceCount = attendanceRecent.filter(r => r.wasPresent).length;
    const attendanceTotal = attendanceRecent.length;

    // Pre-compute per-KPI rankings for kpiTopN rules
    const dailyByRule = await prisma.dailyAchievement.groupBy({
      by: ["ruleName", "agentId"],
      where: { competitionId: result.competitionId },
      _sum: { points: true },
    });
    const kpiRankings = new Map<string, Map<string, number>>();
    const ruleGroups = new Map<string, Map<string, number>>();
    for (const d of dailyByRule) {
      if (!d.ruleName) continue;
      let agents = ruleGroups.get(d.ruleName);
      if (!agents) {
        agents = new Map();
        ruleGroups.set(d.ruleName, agents);
      }
      agents.set(d.agentId, d._sum.points ?? 0);
    }
    for (const [ruleName, agentPoints] of ruleGroups) {
      const sorted = Array.from(agentPoints.entries())
        .sort(([, a], [, b]) => b - a);
      const ranks = new Map<string, number>();
      sorted.forEach(([agentId], idx) => ranks.set(agentId, idx + 1));
      kpiRankings.set(ruleName, ranks);
    }
    const userKpiRanks: Record<string, number> = {};
    for (const [ruleName, ranks] of kpiRankings) {
      const r = ranks.get(userId);
      if (r !== undefined) userKpiRanks[ruleName] = r;
    }

    const ruleCtx: ExtendedRuleCtx = {
      rank: result.rank,
      totalScore: result.totalScore,
      improvement: result.previousRank !== null ? result.previousRank - result.rank : 0,
      wasPresent: result.wasPresent,
      streak: winStreak,
      totalCompetitions: resultCount,
      percentile: totalParticipants > 0 ? (result.rank / totalParticipants) * 100 : undefined,
      totalParticipants,
      consecutiveCompetitions,
      attendanceCount,
      attendanceTotal,
      bestSingleScore,
      bestSingleRank,
      previousRanks,
      kpiRanks: userKpiRanks,
    };

    const competitionBadges = await prisma.badge.findMany({
      where: {
        isActive: true,
        scope: "COMPETITION",
      },
    });

    for (const badge of competitionBadges) {
      if (!evaluateCriteria(badge.criteria, ruleCtx)) continue;

      const existingBadge = await prisma.agentBadge.findFirst({
        where: {
          userId,
          badgeId: badge.id,
          competitionId: result.competitionId,
        },
      });

      if (existingBadge) continue;

      await prisma.agentBadge.create({
        data: {
          userId,
          badgeId: badge.id,
          competitionId: result.competitionId,
          context: {
            competitionId: result.competitionId,
            rank: result.rank,
            score: result.totalScore,
          } as Prisma.InputJsonValue,
          earnedAt: result.competitionEndsAt ?? undefined,
        },
      });
      awarded.push(badge.key);

    }

    return awarded;
  },
};
