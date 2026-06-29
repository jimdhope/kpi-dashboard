import { prisma } from "@/server/db/client";
import type { Prisma } from "@prisma/client";
import { notificationService } from "@/server/services/notification-service";

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

    const allResults = await prisma.competitionResult.findMany({
      where: { agentProfileId },
      orderBy: { createdAt: "desc" },
    });
    const totalScores = allResults.map((r) => r.totalScore);
    const maxScore = totalScores.length > 0 ? Math.max(...totalScores) : 0;

    const highestEver = await prisma.competitionResult.findFirst({
      orderBy: { totalScore: "desc" },
      select: { totalScore: true },
    });

    const badgeChecks: Array<{
      key: string;
      condition: boolean;
      context?: Record<string, unknown>;
    }> = [
      { key: "first_win", condition: result.rank === 1 && !existingKeys.has("first_win") },
      { key: "podium", condition: result.rank <= 3 },
      { key: "veteran", condition: resultCount >= 10 },
      {
        key: "comeback_kid",
        condition:
          result.previousRank !== null &&
          result.previousRank - result.rank >= 5,
        context: { rankImprovement: result.previousRank! - result.rank },
      },
      {
        key: "score_machine",
        condition: result.totalScore > (highestEver?.totalScore ?? 0),
        context: { score: result.totalScore },
      },
      { key: "perfect_attendance", condition: result.wasPresent },
      { key: "streak_3", condition: winStreak >= 3 },
      { key: "streak_5", condition: winStreak >= 5 },
      { key: "streak_10", condition: winStreak >= 10 },
      { key: "three_peat", condition: winStreak === 3 },
    ];

    for (const check of badgeChecks) {
      if (!check.condition) continue;

      const badge = await prisma.badge.findUnique({ where: { key: check.key } });
      if (!badge) continue;

      if (!existingKeys.has(check.key)) {
        await prisma.agentBadge.create({
          data: {
            agentProfileId,
            badgeId: badge.id,
            context: (check.context ?? {
              competitionId: result.competitionId,
              rank: result.rank,
            }) as Prisma.InputJsonValue,
          },
        });
        awarded.push(check.key);

        await notificationService.create({
          userId: result.userId,
          type: "score_achievement",
          title: `Badge Earned: ${badge.name}`,
          message: `You earned the "${badge.name}" badge ${getBadgeContextMessage(check.key, result)}`,
          priority: "high",
          actionUrl: "/agent/gamification",
        });
      }
    }

    return awarded;
  },
};

function getBadgeContextMessage(key: string, result: CompetitionResultInfo): string {
  const map: Record<string, string> = {
    first_win: `by finishing 1st in "${result.competitionName}"!`,
    podium: `by placing #${result.rank} in "${result.competitionName}"!`,
    veteran: "for completing 10 competitions!",
    comeback_kid: "for a massive rank improvement!",
    score_machine: "for achieving the highest score ever!",
    perfect_attendance: "for perfect attendance!",
    three_peat: "for 3 consecutive wins!",
    streak_3: "for a 3-win streak!",
    streak_5: "for a 5-win streak!",
    streak_10: "for a 10-win streak!",
  };
  return map[key] ?? "";
}
