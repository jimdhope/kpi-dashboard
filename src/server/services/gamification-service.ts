import { prisma } from "@/server/db/client";
import type { Prisma } from "@prisma/client";
import { badgeService } from "@/server/services/badge-service";
import { activityService } from "@/server/services/activity-service";
import { evaluateCriteria, type RuleContext } from "./rule-evaluator";

const LEVEL_THRESHOLDS = [
  { minPoints: 0, title: "Rookie" },
  { minPoints: 500, title: "Bronze" },
  { minPoints: 1_500, title: "Silver" },
  { minPoints: 3_500, title: "Gold" },
  { minPoints: 7_000, title: "Platinum" },
  { minPoints: 12_000, title: "Diamond" },
];

function calculateLevel(totalPoints: number): { level: number; title: string } {
  let level = 1;
  let title = LEVEL_THRESHOLDS[0].title;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalPoints >= LEVEL_THRESHOLDS[i].minPoints) {
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

    const scoreEvents = await prisma.scoreEvent.groupBy({
      by: ["subjectAgentId"],
      where: { competitionId, voidedAt: null },
      _sum: { points: true },
    });
    const scoreMap = new Map(scoreEvents.map((event) => [event.subjectAgentId, event._sum.points ?? 0]));

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

    let totalPointsAwarded = 0;
    let totalBadgesAwarded = 0;
    const allBadges: string[] = [];
    let resultsCreated = 0;
    const previousRanks = new Map<string, number>();

    for (const agent of rankedAgents) {
      const pointsEarned = agent.totalScore;
      totalPointsAwarded += pointsEarned;

      const user = await prisma.user.findUnique({
        where: { id: agent.userId },
      });

      if (!user) continue;

      const prevResult = await prisma.competitionResult.findFirst({
        where: {
          userId: agent.userId,
          competition: {
            id: { not: competitionId }
          }
        },
        orderBy: { createdAt: "desc" },
      });
      const previousRank = prevResult?.rank ?? null;
      previousRanks.set(agent.userId, previousRank ?? 0);

      const existingResult = await prisma.competitionResult.findUnique({
        where: {
          userId_competitionId: {
            userId: agent.userId,
            competitionId,
          },
        },
      });

      if (existingResult) {
        await prisma.competitionResult.update({
          where: { id: existingResult.id },
          data: {
            rank: agent.rank,
            totalScore: agent.totalScore,
            xpEarned: agent.totalScore,
            wasPresent: agent.wasPresent,
            createdAt: competition.endsAt ?? undefined,
          },
        });
      } else {
        await prisma.competitionResult.create({
          data: {
            userId: agent.userId,
            competitionId,
            rank: agent.rank,
            totalScore: agent.totalScore,
            xpEarned: agent.totalScore,
            wasPresent: agent.wasPresent,
            createdAt: competition.endsAt ?? undefined,
          },
        });
        resultsCreated++;
      }
       const oldTotalPoints = user.totalPoints;

      const newTotalPoints = oldTotalPoints + pointsEarned;
      const { level: newLevel, title: newTitle } = calculateLevel(newTotalPoints);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          totalPoints: newTotalPoints,
        },
      });

      const oldLevel = calculateLevel(oldTotalPoints);
      if (newLevel > oldLevel.level) {
        await activityService.logMilestoneReached({
          userId: agent.userId,
          milestoneName: `level_${newLevel}`,
          userName: agent.agentName,
        });

      }

      const awarded = await badgeService.checkAndAwardBadges({
        userId: agent.userId,
        agentName: agent.agentName,
        competitionId,
        competitionName: competition.name,
        rank: agent.rank,
        totalScore: agent.totalScore,
        wasPresent: agent.wasPresent,
        previousRank,
        totalParticipants: rankedAgents.length,
        competitionEndsAt: competition.endsAt ?? undefined,
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
      xpAwarded: totalPointsAwarded,
    };

  },

  async getAgentProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        badges: { include: { badge: true, competition: { select: { name: true } } }, orderBy: { earnedAt: "desc" } },
      },
    });

    if (!user) return null;

    const nextLevel = LEVEL_THRESHOLDS.find((t) => t.minPoints > user.totalPoints);
    const currentLevel = calculateLevel(user.totalPoints);
    const nextThreshold = nextLevel?.minPoints ?? user.totalPoints;
    const prevThreshold = LEVEL_THRESHOLDS[currentLevel.level - 1]?.minPoints ?? 0;
    const progress = nextThreshold - prevThreshold > 0
      ? ((user.totalPoints - prevThreshold) / (nextThreshold - prevThreshold)) * 100
      : 100;

    return {
      userId: user.id,
      totalPoints: user.totalPoints,
      badges: user.badges,
      progress: Math.min(100, Math.max(0, progress)),
      currentTitle: currentLevel.title,
      pointsToNextLevel: nextThreshold - user.totalPoints,
    };
  },

  async getAllTimeLeaderboard(podId?: string, limit = 50, offset = 0) {
    const where = podId ? { podId } : {};
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { totalPoints: "desc" },
        take: limit,
        skip: offset,
        include: {
          badges: { take: 1 },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      entries: users.map((u, i) => ({
        rank: offset + i + 1,
        userId: u.id,
        name: u.name ?? u.email ?? "Unknown",
        totalPoints: u.totalPoints,
        level: calculateLevel(u.totalPoints).level,
        title: calculateLevel(u.totalPoints).title,
        avatarUrl: u.avatarUrl,
        avatarInitials: u.avatarInitials,
        avatarBgColor: u.avatarBgColor,
        badgeCount: u.badges.length,
      })),
      total,
    };
  },

  async getMonthlyLeaderboard(year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const results = await prisma.competitionResult.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    const pointsByUser = new Map<string, { name: string; points: number }>();
    for (const res of results) {
      const existing = pointsByUser.get(res.userId) ?? {
        name: res.user.name ?? res.user.email ?? "Unknown",
        points: 0,
      };
      existing.points += res.totalScore;
      pointsByUser.set(res.userId, existing);
    }

    const sorted = Array.from(pointsByUser.entries())
      .map(([userId, data], index) => ({ rank: index + 1, userId, ...data }))
      .sort((a, b) => b.points - a.points)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    return { year, month, entries: sorted };
  },

  async getYearlyLeaderboard(year: number) {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);

    const results = await prisma.competitionResult.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    const pointsByUser = new Map<string, { name: string; points: number }>();
    for (const res of results) {
      const existing = pointsByUser.get(res.userId) ?? {
        name: res.user.name ?? res.user.email ?? "Unknown",
        points: 0,
      };
      existing.points += res.totalScore;
      pointsByUser.set(res.userId, existing);
    }

    const sorted = Array.from(pointsByUser.entries())
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.points - a.points)
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
    const lastDay = new Date(year, month, 0);

    const monthlyBadges = await prisma.badge.findMany({
      where: { isActive: true, scope: "MONTHLY" },
    });

    const totalParticipants = leaderboard.entries.length;

    // Pre-compute per-KPI rankings for kpiTopN rules
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
    const dailyByRule = await prisma.scoreEvent.groupBy({
      by: ["ruleName", "subjectAgentId"],
      where: {
        scoredForDate: { gte: monthStart, lte: monthEnd },
        ruleName: { not: null },
        voidedAt: null,
      },
      _sum: { points: true },
    });
    const monthlyKpiRankings = new Map<string, Map<string, number>>();
    const ruleGroups = new Map<string, Map<string, number>>();
    for (const d of dailyByRule) {
      if (!d.ruleName) continue;
      let agents = ruleGroups.get(d.ruleName);
      if (!agents) {
        agents = new Map();
        ruleGroups.set(d.ruleName, agents);
      }
      agents.set(d.subjectAgentId, d._sum.points ?? 0);
    }
    for (const [ruleName, agentPoints] of ruleGroups) {
      const sorted = Array.from(agentPoints.entries())
        .sort(([, a], [, b]) => b - a);
      const ranks = new Map<string, number>();
      sorted.forEach(([agentId], idx) => ranks.set(agentId, idx + 1));
      monthlyKpiRankings.set(ruleName, ranks);
    }

    for (const entry of leaderboard.entries) {
      const user = await prisma.user.findUnique({ where: { id: entry.userId } });
      if (!user) continue;

      // Compute monthly history for extended context
      const monthlyResults = await prisma.competitionResult.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 12,
      });

      const prevYear = year - (month === 1 ? 1 : 0);
      const prevMonth = month === 1 ? 12 : month - 1;
      const previousMonthScore = leaderboard.entries.find(e => e.userId === user.id)?.points ?? 0;
      const totalMonths = await prisma.competitionResult.count({ where: { userId: user.id } });

      const bestSingleScore = Math.max(...monthlyResults.map(r => r.totalScore), 0);
      const bestSingleRank = Math.min(...monthlyResults.map(r => r.rank), 999);
      const previousRanks = monthlyResults.slice(0, 6).map(r => r.rank);
      const improvement = entry.rank < bestSingleRank ? bestSingleRank - entry.rank : 0;

      const attendanceRecent = monthlyResults.slice(0, 6);
      const attendanceCount = attendanceRecent.filter(r => r.wasPresent).length;
      const attendanceTotal = attendanceRecent.length || 1;

      const consecutiveCompetitions = monthlyResults.length;

      // Compute streak: consecutive months in top N (same as rank 1 for simple win streak)
      let streak = 0;
      for (const res of monthlyResults) {
        if (res.rank === 1) streak++;
        else break;
      }

      for (const badge of monthlyBadges) {
        const existing = await prisma.agentBadge.findFirst({
          where: { userId: user.id, badgeId: badge.id, competitionId: null },
        });
        if (existing) continue;

        const userKpiRanks: Record<string, number> = {};
        for (const [ruleName, ranks] of monthlyKpiRankings) {
          const r = ranks.get(user.id);
          if (r !== undefined) userKpiRanks[ruleName] = r;
        }

        const ruleCtx: RuleContext = {
          rank: entry.rank,
          totalScore: entry.points,
          improvement,
          wasPresent: true,
          streak,
          totalCompetitions: totalMonths,
          percentile: totalParticipants > 0 ? (entry.rank / totalParticipants) * 100 : undefined,
          totalParticipants,
          consecutiveCompetitions,
          attendanceCount,
          attendanceTotal,
          bestSingleScore,
          bestSingleRank,
          previousRanks,
          kpiRanks: userKpiRanks,
        };

        if (!evaluateCriteria(badge.criteria, ruleCtx)) continue;

        await prisma.agentBadge.create({
          data: {
            userId: user.id,
            badgeId: badge.id,
            context: { month, year, rank: entry.rank } as Prisma.InputJsonValue,
            earnedAt: lastDay,
          },
        });

        if (entry.userId === champion.userId) {
        }
      }
    }

    return { champion: champion.name, month, year };
  },

  async crownYearlyChampion(year: number) {
    const leaderboard = await this.getYearlyLeaderboard(year);
    if (leaderboard.entries.length === 0) {
      throw new Error("No participants found for this year");
    }

    const champion = leaderboard.entries[0];
    const lastDay = new Date(year, 11, 31);

    const yearlyBadges = await prisma.badge.findMany({
      where: { isActive: true, scope: "YEARLY" },
    });

    const totalParticipants = leaderboard.entries.length;

    // Pre-compute per-KPI rankings for kpiTopN rules
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
    const dailyByRule = await prisma.scoreEvent.groupBy({
      by: ["ruleName", "subjectAgentId"],
      where: {
        scoredForDate: { gte: yearStart, lte: yearEnd },
        ruleName: { not: null },
        voidedAt: null,
      },
      _sum: { points: true },
    });
    const yearlyKpiRankings = new Map<string, Map<string, number>>();
    const ruleGroups = new Map<string, Map<string, number>>();
    for (const d of dailyByRule) {
      if (!d.ruleName) continue;
      let agents = ruleGroups.get(d.ruleName);
      if (!agents) {
        agents = new Map();
        ruleGroups.set(d.ruleName, agents);
      }
      agents.set(d.subjectAgentId, d._sum.points ?? 0);
    }
    for (const [ruleName, agentPoints] of ruleGroups) {
      const sorted = Array.from(agentPoints.entries())
        .sort(([, a], [, b]) => b - a);
      const ranks = new Map<string, number>();
      sorted.forEach(([agentId], idx) => ranks.set(agentId, idx + 1));
      yearlyKpiRankings.set(ruleName, ranks);
    }

    for (const entry of leaderboard.entries) {
      const user = await prisma.user.findUnique({ where: { id: entry.userId } });
      if (!user) continue;

      const yearlyResults = await prisma.competitionResult.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 12,
      });

      const totalYears = await prisma.competitionResult.count({ where: { userId: user.id } });

      const bestSingleScore = Math.max(...yearlyResults.map(r => r.totalScore), 0);
      const bestSingleRank = Math.min(...yearlyResults.map(r => r.rank), 999);
      const previousRanks = yearlyResults.slice(0, 6).map(r => r.rank);
      const improvement = entry.rank < bestSingleRank ? bestSingleRank - entry.rank : 0;

      const attendanceRecent = yearlyResults.slice(0, 6);
      const attendanceCount = attendanceRecent.filter(r => r.wasPresent).length;
      const attendanceTotal = attendanceRecent.length || 1;

      const consecutiveCompetitions = yearlyResults.length;

      let streak = 0;
      for (const res of yearlyResults) {
        if (res.rank === 1) streak++;
        else break;
      }

      for (const badge of yearlyBadges) {
        const existing = await prisma.agentBadge.findFirst({
          where: { userId: user.id, badgeId: badge.id, competitionId: null },
        });
        if (existing) continue;

        const userKpiRanks: Record<string, number> = {};
        for (const [ruleName, ranks] of yearlyKpiRankings) {
          const r = ranks.get(user.id);
          if (r !== undefined) userKpiRanks[ruleName] = r;
        }

        const ruleCtx: RuleContext = {
          rank: entry.rank,
          totalScore: entry.points,
          improvement,
          wasPresent: true,
          streak,
          totalCompetitions: totalYears,
          percentile: totalParticipants > 0 ? (entry.rank / totalParticipants) * 100 : undefined,
          totalParticipants,
          consecutiveCompetitions,
          attendanceCount,
          attendanceTotal,
          bestSingleScore,
          bestSingleRank,
          previousRanks,
          kpiRanks: userKpiRanks,
        };

        if (!evaluateCriteria(badge.criteria, ruleCtx)) continue;

        await prisma.agentBadge.create({
          data: {
            userId: user.id,
            badgeId: badge.id,
            context: { year, rank: entry.rank } as Prisma.InputJsonValue,
            earnedAt: lastDay,
          },
        });

        if (entry.userId === champion.userId) {
        }
      }
    }

    return { champion: champion.name, year };
  },

  async getBadgeCatalog(userId?: string) {
    const badges = await prisma.badge.findMany({
      orderBy: { sortOrder: "asc" },
    });

    if (!userId) {
      return badges.map((b) => ({ ...b, earned: false, earnedAt: null }));
    }

    const userBadges = await prisma.agentBadge.findMany({
      where: { userId },
    });

    const earnedIds = new Set(userBadges.map((ab) => ab.badgeId));

    return badges.map((b) => ({
      ...b,
      earned: earnedIds.has(b.id),
      earnedAt: userBadges.find((ab) => ab.badgeId === b.id)?.earnedAt ?? null,
    }));
  },

  async getBadgeAgents(badgeKey: string) {
    const badge = await prisma.badge.findUnique({
      where: { key: badgeKey },
      include: {
        agentBadges: {
          include: {
            user: { select: { name: true, email: true } },
          },
          orderBy: { earnedAt: "desc" },
        },
      },
    });
    if (!badge) throw new Error("Badge not found");

    return badge.agentBadges.map((ab) => ({
      userId: ab.userId,
      name: ab.user.name ?? ab.user.email ?? "Unknown",
      earnedAt: ab.earnedAt,
      context: ab.context,
    }));
  },

  async getAdminStats() {
    const [totalProfiles, totalBadgesAwarded, evaluatedCompetitions, totalPoints] = await Promise.all([
      prisma.user.count({ where: { userRoles: { some: { role: { key: "agent" } } } } }),
      prisma.agentBadge.count(),
      prisma.competitionResult.findFirst({ orderBy: { createdAt: "desc" }, select: { competitionId: true } }),
      prisma.user.aggregate({ _sum: { totalPoints: true } }),
    ]);

    const uniqueCompetitions = await prisma.competitionResult.findMany({
      distinct: ["competitionId"],
      select: { competitionId: true },
    });

    return {
      totalProfiles,
      totalBadgesAwarded,
      evaluatedCompetitions: uniqueCompetitions.length,
      totalPointsAwarded: totalPoints._sum.totalPoints ?? 0,
    };
  },

  async getAgentHistory(userId: string) {
    const [results] = await Promise.all([
      prisma.competitionResult.findMany({
        where: { userId },
        include: {
          user: { select: { name: true, email: true } },
          competition: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    return { results, transactions: [] };
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
      include: {
        results: {
          include: { user: { select: { name: true, email: true } } },
          orderBy: { rank: "asc" },
        },
      },
      orderBy: { endsAt: "asc" },
    });

    const summaries: EvaluationSummary[] = [];
    for (const competition of competitions) {
      let badgesAwarded = 0;
      const badgeList: string[] = [];

      for (const result of competition.results) {
        const awarded = await badgeService.checkAndAwardBadges({
          userId: result.userId,
          agentName: result.user.name ?? result.user.email ?? "Unknown",
          competitionId: competition.id,
          competitionName: competition.name,
          rank: result.rank,
          totalScore: result.totalScore,
          wasPresent: result.wasPresent,
          previousRank: null,
          totalParticipants: competition.results.length,
          competitionEndsAt: competition.endsAt ?? undefined,
        });

        for (const badgeKey of awarded) {
          badgeList.push(badgeKey);
          badgesAwarded++;
        }
      }

      if (badgesAwarded > 0) {
        summaries.push({
          competitionId: competition.id,
          competitionName: competition.name,
          agentsProcessed: competition.results.length,
          resultsCreated: 0,
          badgesAwarded,
          badgeList,
          xpAwarded: 0,
        });
      }
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
export { LEVEL_THRESHOLDS, calculateLevel };
