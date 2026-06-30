import { prisma } from "@/server/db/client";
import { badgeService } from "@/server/services/badge-service";
import { activityService } from "@/server/services/activity-service";
import { notificationService } from "@/server/services/notification-service";

const RANK_BONUSES: Record<number, number> = {
  1: 100,
  2: 50,
  3: 25,
};

const LEVEL_THRESHOLDS = [
  { minXp: 0, title: "Rookie" },
  { minXp: 500, title: "Bronze" },
  { minXp: 1_500, title: "Silver" },
  { minXp: 3_500, title: "Gold" },
  { minXp: 7_000, title: "Platinum" },
  { minXp: 12_000, title: "Diamond" },
];

function calculateLevel(totalXp: number): { level: number; title: string } {
  let level = 1;
  let title = LEVEL_THRESHOLDS[0].title;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVEL_THRESHOLDS[i].minXp) {
      level = i + 1;
      title = LEVEL_THRESHOLDS[i].title;
      break;
    }
  }
  return { level, title };
}

export interface EvaluationSummary {
  competitionId: string;
  competitionName: string;
  agentsProcessed: number;
  resultsCreated: number;
  badgesAwarded: number;
  badgeList: string[];
  xpAwarded: number;
}

export const gamificationService = {
  async evaluateCompetitionEnd(competitionId: string): Promise<EvaluationSummary> {
    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      include: {
        teams: true,
        entries: {
          include: { user: true },
        },
      },
    });

    if (!competition) throw new Error("Competition not found");
    if (competition.endsAt && competition.endsAt > new Date()) {
      throw new Error("Competition has not ended yet");
    }

    const dailyScores = await prisma.dailyAchievement.groupBy({
      by: ["agentId"],
      where: { competitionId },
      _sum: { points: true },
    });
    const scoreMap = new Map(dailyScores.map((d) => [d.agentId, d._sum.points ?? 0]));

    const agentScores = new Map<string, {
      userId: string;
      agentName: string;
      totalScore: number;
      wasPresent: boolean;
      teamId: string | null;
    }>();

    for (const entry of competition.entries) {
      if (!entry.userId || !entry.user) continue;
      const score = scoreMap.get(entry.userId) ?? 0;
      const team = competition.teams.find((t) => t.agentIds.includes(entry.userId!));
      agentScores.set(entry.userId, {
        userId: entry.userId,
        agentName: entry.user.name || entry.user.email || "Unknown",
        totalScore: score,
        wasPresent: entry.present,
        teamId: team?.id ?? null,
      });
    }

    const sortedAgents = Array.from(agentScores.values()).sort(
      (a, b) => b.totalScore - a.totalScore
    );

    let denseRank = 0;
    let prevScore: number | null = null;
    const rankedAgents = sortedAgents.map((agent, index) => {
      if (agent.totalScore !== prevScore) {
        denseRank = index + 1;
        prevScore = agent.totalScore;
      }
      return { ...agent, rank: denseRank };
    });

    let totalXpAwarded = 0;
    let totalBadgesAwarded = 0;
    const allBadges: string[] = [];
    let resultsCreated = 0;
    const previousRanks = new Map<string, number>();

    for (const agent of rankedAgents) {
      const rankBonus = RANK_BONUSES[agent.rank] ?? 0;
      const xpEarned = agent.totalScore + rankBonus;
      totalXpAwarded += xpEarned;

      let profile = await prisma.agentProfile.findUnique({
        where: { userId: agent.userId },
      });

      if (!profile) {
        profile = await prisma.agentProfile.create({
          data: { userId: agent.userId },
        });
      }

      const prevResult = await prisma.competitionResult.findFirst({
        where: { agentProfileId: profile.id },
        orderBy: { createdAt: "desc" },
      });
      const previousRank = prevResult?.rank ?? null;
      previousRanks.set(agent.userId, previousRank ?? 0);

      await prisma.competitionResult.create({
        data: {
          agentProfileId: profile.id,
          competitionId,
          rank: agent.rank,
          totalScore: agent.totalScore,
          xpEarned,
          wasPresent: agent.wasPresent,
          createdAt: competition.endsAt ?? undefined,
        },
      });
      resultsCreated++;

      if (agent.totalScore > 0) {
        await prisma.xpTransaction.create({
          data: {
            userId: agent.userId,
            amount: agent.totalScore,
            source: "competition_score",
            sourceId: competitionId,
            description: `Score from "${competition.name}"`,
            createdAt: competition.endsAt ?? undefined,
          },
        });
      }

      if (rankBonus > 0) {
        await prisma.xpTransaction.create({
          data: {
            userId: agent.userId,
            amount: rankBonus,
            source: "rank_bonus",
            sourceId: competitionId,
            description: `Rank #${agent.rank} bonus in "${competition.name}"`,
            createdAt: competition.endsAt ?? undefined,
          },
        });
      }

      const oldTotalXp = profile.totalXp;
      const newTotalXp = oldTotalXp + xpEarned;
      const { level: newLevel, title: newTitle } = calculateLevel(newTotalXp);

      await prisma.agentProfile.update({
        where: { id: profile.id },
        data: {
          totalXp: newTotalXp,
        },
      });

      const oldLevel = calculateLevel(oldTotalXp);
      if (newLevel > oldLevel.level) {
        await activityService.logMilestoneReached({
          userId: agent.userId,
          milestoneName: `level_${newLevel}`,
          userName: agent.agentName,
        });

        await notificationService.create({
          userId: agent.userId,
          type: "score_achievement",
          title: `Level Up! You're now ${newTitle}`,
          message: `You reached Level ${newLevel} — ${newTitle} with ${newTotalXp.toLocaleString()} total XP!`,
          priority: "high",
          actionUrl: "/agent/gamification",
        });
      }

      // Update win streak
      if (agent.rank === 1) {
        const streak = await prisma.streak.upsert({
          where: { agentProfileId_type: { agentProfileId: profile.id, type: "win" } },
          create: { agentProfileId: profile.id, type: "win", currentCount: 1, longestCount: 1 },
          update: {
            currentCount: { increment: 1 },
          },
        });
        if (streak.currentCount > streak.longestCount) {
          await prisma.streak.update({
            where: { id: streak.id },
            data: { longestCount: streak.currentCount },
          });
        }
        if (streak.currentCount === 3) {
          await notificationService.create({
            userId: agent.userId,
            type: "score_achievement",
            title: "🔥 Three-Peat!",
            message: `You've won 3 competitions in a row!`,
            priority: "high",
            actionUrl: "/agent/gamification",
          });
        }
      } else {
        await prisma.streak.upsert({
          where: { agentProfileId_type: { agentProfileId: profile.id, type: "win" } },
          create: { agentProfileId: profile.id, type: "win" },
          update: { currentCount: 0 },
        });
      }

      // Update podium streak (rank <= 3)
      if (agent.rank <= 3) {
        await prisma.streak.upsert({
          where: { agentProfileId_type: { agentProfileId: profile.id, type: "podium" } },
          create: { agentProfileId: profile.id, type: "podium", currentCount: 1, longestCount: 1 },
          update: {
            currentCount: { increment: 1 },
          },
        });
      } else {
        await prisma.streak.upsert({
          where: { agentProfileId_type: { agentProfileId: profile.id, type: "podium" } },
          create: { agentProfileId: profile.id, type: "podium" },
          update: { currentCount: 0 },
        });
      }

      // Check badges
      const awarded = await badgeService.checkAndAwardBadges({
        agentProfileId: profile.id,
        userId: agent.userId,
        agentName: agent.agentName,
        competitionId,
        competitionName: competition.name,
        rank: agent.rank,
        totalScore: agent.totalScore,
        wasPresent: agent.wasPresent,
        previousRank,
      });

      for (const badgeKey of awarded) {
        allBadges.push(badgeKey);
        totalBadgesAwarded++;

        await activityService.logBadgeEarned({
          userId: agent.userId,
          badgeName: badgeKey,
          userName: agent.agentName,
        });
      }
    }

    return {
      competitionId,
      competitionName: competition.name,
      agentsProcessed: rankedAgents.length,
      resultsCreated,
      badgesAwarded: totalBadgesAwarded,
      badgeList: allBadges,
      xpAwarded: totalXpAwarded,
    };
  },

  async getAgentProfile(userId: string) {
    const profile = await prisma.agentProfile.findUnique({
      where: { userId },
      include: {
        badges: { include: { badge: true }, orderBy: { earnedAt: "desc" } },
        streaks: true,
        results: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    if (!profile) return null;

    const nextLevel = LEVEL_THRESHOLDS.find((t) => t.minXp > profile.totalXp);
    const currentLevel = calculateLevel(profile.totalXp);
    const nextThreshold = nextLevel?.minXp ?? profile.totalXp;
    const prevThreshold = LEVEL_THRESHOLDS[currentLevel.level - 1]?.minXp ?? 0;
    const xpProgress = nextThreshold - prevThreshold > 0
      ? ((profile.totalXp - prevThreshold) / (nextThreshold - prevThreshold)) * 100
      : 100;

    return {
      ...profile,
      xpProgress: Math.min(100, Math.max(0, xpProgress)),
      currentTitle: currentLevel.title,
      xpToNextLevel: nextThreshold - profile.totalXp,
    };
  },

  async getAllTimeLeaderboard(podId?: string, limit = 50, offset = 0) {
    const where = podId ? { user: { podId } } : {};
    const [profiles, total] = await Promise.all([
      prisma.agentProfile.findMany({
        where,
        orderBy: { totalXp: "desc" },
        take: limit,
        skip: offset,
        include: {
          user: { select: { name: true, email: true, avatarUrl: true, avatarInitials: true, avatarBgColor: true } },
          results: { orderBy: { createdAt: "desc" }, take: 1 },
          badges: { take: 1 },
        },
      }),
      prisma.agentProfile.count({ where }),
    ]);

    return {
      entries: profiles.map((p, i) => ({
        rank: offset + i + 1,
        userId: p.userId,
        name: p.user.name ?? p.user.email ?? "Unknown",
        totalXp: p.totalXp,
        level: calculateLevel(p.totalXp).level,
        title: calculateLevel(p.totalXp).title,
        avatarUrl: p.user.avatarUrl,
        avatarInitials: p.user.avatarInitials,
        avatarBgColor: p.user.avatarBgColor,
        lastRank: p.results[0]?.rank ?? null,
        badgeCount: p.badges.length,
      })),
      total,
    };
  },

  async getMonthlyLeaderboard(year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const transactions = await prisma.xpTransaction.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        source: { in: ["competition_score", "rank_bonus"] },
      },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    const xpByUser = new Map<string, { name: string; xp: number; badgeCount: number }>();
    for (const tx of transactions) {
      const existing = xpByUser.get(tx.userId) ?? {
        name: tx.user.name ?? tx.user.email ?? "Unknown",
        xp: 0,
        badgeCount: 0,
      };
      existing.xp += tx.amount;
      xpByUser.set(tx.userId, existing);
    }

    const sorted = Array.from(xpByUser.entries())
      .map(([userId, data], index) => ({ rank: index + 1, userId, ...data }))
      .sort((a, b) => b.xp - a.xp)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    return { year, month, entries: sorted };
  },

  async getYearlyLeaderboard(year: number) {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);

    const transactions = await prisma.xpTransaction.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        source: { in: ["competition_score", "rank_bonus"] },
      },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    const xpByUser = new Map<string, { name: string; xp: number }>();
    for (const tx of transactions) {
      const existing = xpByUser.get(tx.userId) ?? {
        name: tx.user.name ?? tx.user.email ?? "Unknown",
        xp: 0,
      };
      existing.xp += tx.amount;
      xpByUser.set(tx.userId, existing);
    }

    const sorted = Array.from(xpByUser.entries())
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.xp - a.xp)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    return { year, entries: sorted };
  },

  async crownMonthlyChampion(year: number, month: number) {
    const leaderboard = await this.getMonthlyLeaderboard(year, month);
    if (leaderboard.entries.length === 0) {
      throw new Error("No participants found for this month");
    }

    const champion = leaderboard.entries[0];
    const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long" });

    const profile = await prisma.agentProfile.findUnique({
      where: { userId: champion.userId },
    });
    if (!profile) throw new Error("Agent profile not found");

    const badge = await prisma.badge.findUnique({ where: { key: "monthly_champion" } });
    if (badge) {
      const existing = await prisma.agentBadge.findUnique({
        where: { agentProfileId_badgeId: { agentProfileId: profile.id, badgeId: badge.id } },
      });
      if (!existing) {
        await prisma.agentBadge.create({
          data: {
            agentProfileId: profile.id,
            badgeId: badge.id,
            context: { month, year, rank: 1 },
          },
        });

        await notificationService.create({
          userId: champion.userId,
          type: "score_achievement",
          title: `👑 ${monthName} Champion!`,
          message: `You're the ${monthName} ${year} Monthly Champion!`,
          priority: "high",
          actionUrl: "/agent/gamification",
        });
      }
    }

    // Also award monthly_top3 to top 3
    const top3Badge = await prisma.badge.findUnique({ where: { key: "monthly_top3" } });
    if (top3Badge) {
      for (const entry of leaderboard.entries.slice(0, 3)) {
        const p = await prisma.agentProfile.findUnique({ where: { userId: entry.userId } });
        if (!p) continue;
        const existing = await prisma.agentBadge.findUnique({
          where: { agentProfileId_badgeId: { agentProfileId: p.id, badgeId: top3Badge.id } },
        });
        if (!existing) {
          await prisma.agentBadge.create({
            data: {
              agentProfileId: p.id,
              badgeId: top3Badge.id,
              context: { month, year, rank: entry.rank },
            },
          });
        }
      }
    }

    return { champion: champion.name, month, year };
  },

  async getBadgeCatalog(userId?: string) {
    const badges = await prisma.badge.findMany({
      orderBy: { sortOrder: "asc" },
    });

    if (!userId) {
      return badges.map((b) => ({ ...b, earned: false, earnedAt: null }));
    }

    const profile = await prisma.agentProfile.findUnique({
      where: { userId },
      include: { badges: true },
    });

    const earnedIds = new Set(profile?.badges.map((ab) => ab.badgeId) ?? []);

    return badges.map((b) => ({
      ...b,
      earned: earnedIds.has(b.id),
      earnedAt: profile?.badges.find((ab) => ab.badgeId === b.id)?.earnedAt ?? null,
    }));
  },

  async getBadgeAgents(badgeKey: string) {
    const badge = await prisma.badge.findUnique({
      where: { key: badgeKey },
      include: {
        agentBadges: {
          include: {
            agentProfile: {
              include: {
                user: { select: { name: true, email: true } },
              },
            },
          },
          orderBy: { earnedAt: "desc" },
        },
      },
    });
    if (!badge) throw new Error("Badge not found");

    return badge.agentBadges.map((ab) => ({
      agentProfileId: ab.agentProfileId,
      name: ab.agentProfile.user.name ?? ab.agentProfile.user.email ?? "Unknown",
      earnedAt: ab.earnedAt,
      context: ab.context,
    }));
  },

  async getAdminStats() {
    const [totalProfiles, totalBadgesAwarded, evaluatedCompetitions, totalXp] = await Promise.all([
      prisma.agentProfile.count(),
      prisma.agentBadge.count(),
      prisma.competitionResult.findFirst({ orderBy: { createdAt: "desc" }, select: { competitionId: true } }),
      prisma.xpTransaction.aggregate({ _sum: { amount: true } }),
    ]);

    const uniqueCompetitions = await prisma.competitionResult.findMany({
      distinct: ["competitionId"],
      select: { competitionId: true },
    });

    return {
      totalProfiles,
      totalBadgesAwarded,
      evaluatedCompetitions: uniqueCompetitions.length,
      totalXpAwarded: totalXp._sum.amount ?? 0,
    };
  },

  async getAgentHistory(userId: string) {
    const [results, transactions] = await Promise.all([
      prisma.competitionResult.findMany({
        where: { agentProfile: { userId } },
        include: {
          agentProfile: {
            include: { badges: { include: { badge: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.xpTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    return { results, transactions };
  },

  async assignEntriesForCompetition(competitionId: string) {
    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      select: { id: true, name: true, podIds: true },
    });
    if (!competition) throw new Error("Competition not found");
    if (!competition.podIds || competition.podIds.length === 0) return 0;

    const podUsers = await prisma.user.findMany({
      where: { podId: { in: competition.podIds } },
      select: { id: true },
    });
    if (podUsers.length === 0) return 0;

    const { count } = await prisma.competitionEntry.createMany({
      data: podUsers.map((u) => ({
        competitionId: competition.id,
        userId: u.id,
      })),
      skipDuplicates: true,
    });
    return count;
  },

  async assignEntriesForAll() {
    const competitions = await prisma.competition.findMany({
      where: {
        isDraft: false,
        podIds: { isEmpty: false },
      },
      select: { id: true, name: true, podIds: true },
    });

    const results: { competitionId: string; competitionName: string; entriesCreated: number }[] = [];
    for (const competition of competitions) {
      const count = await this.assignEntriesForCompetition(competition.id);
      if (count > 0) {
        results.push({ competitionId: competition.id, competitionName: competition.name, entriesCreated: count });
      }
    }
    return results;
  },

  async retroactivelyEvaluateAll() {
    const competitions = await prisma.competition.findMany({
      where: {
        isDraft: false,
        endsAt: { lte: new Date() },
      },
      orderBy: { endsAt: "asc" },
    });

    const summaries: EvaluationSummary[] = [];
    for (const competition of competitions) {
      const existing = await prisma.competitionResult.findFirst({
        where: { competitionId: competition.id },
      });
      if (existing) continue;

      const summary = await this.evaluateCompetitionEnd(competition.id);
      summaries.push(summary);
    }

    return summaries;
  },

  async getPendingCompetitions() {
    return prisma.competition.findMany({
      where: {
        isDraft: false,
        endsAt: { lte: new Date() },
      },
      orderBy: { endsAt: "desc" },
      take: 50,
    });
  },
};

// Level thresholds export for admin config
export { LEVEL_THRESHOLDS, RANK_BONUSES, calculateLevel };
