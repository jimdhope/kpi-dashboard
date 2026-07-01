import { prisma } from "@/server/db/client";
import type { Prisma } from "@prisma/client";
import { notificationService } from "@/server/services/notification-service";
import { evaluateCriteria, type RuleContext } from "./rule-evaluator";

interface CompetitionResultInfo {
  agentProfileId: string;
  userId: string;
  agentName: string;
  competitionId: string;
  competitionName: string;
  rank: number;
  totalScore: number;
  wasPresent: boolean;
  previousRank: number | null;
  competitionEndsAt?: Date;
}

export const badgeService = {
  async checkAndAwardBadges(result: CompetitionResultInfo): Promise<string[]> {
    const awarded: string[] = [];
    const agentProfileId = result.agentProfileId;
    const existingBadges = await prisma.agentBadge.findMany({
      where: { agentProfileId },
      include: { badge: true },
    });
    const existingKeys = new Set(existingBadges.map((ab) => ab.badge.key));

    const streakResult = await prisma.streak.findUnique({
      where: { agentProfileId_type: { agentProfileId, type: "win" } },
    });
    const winStreak = streakResult?.currentCount ?? 0;

    const resultCount = await prisma.competitionResult.count({
      where: { agentProfileId },
    });

    const highestEver = await prisma.competitionResult.findFirst({
      orderBy: { totalScore: "desc" },
      select: { totalScore: true },
    });

    const ruleCtx: RuleContext = {
      rank: result.rank,
      totalScore: result.totalScore,
      improvement: result.previousRank !== null ? result.previousRank - result.rank : 0,
      wasPresent: result.wasPresent,
      streak: winStreak,
      totalCompetitions: resultCount,
    };

    const competitionBadges = await prisma.badge.findMany({
      where: {
        isActive: true,
        scope: "COMPETITION",
      },
    });

    for (const badge of competitionBadges) {
      if (existingKeys.has(badge.key)) continue;

      if (!evaluateCriteria(badge.criteria, ruleCtx)) continue;

      await prisma.agentBadge.create({
        data: {
          agentProfileId,
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

      await notificationService.create({
        userId: result.userId,
        type: "score_achievement",
        title: `Badge Earned: ${badge.name}`,
        message: `You earned the "${badge.name}" badge${result.competitionName ? ` in "${result.competitionName}"` : ""}!`,
        priority: "high",
        actionUrl: "/agent/gamification",
      });
    }

    return awarded;
  },
};
