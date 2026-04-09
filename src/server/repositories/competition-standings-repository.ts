import { prisma } from "@/server/db/client";

export interface PodStandings {
  podId: string;
  podName: string;
  totalScore: number;
  rank: number;
  memberCount: number;
}

export interface TeamStandings {
  teamId: string;
  teamName: string;
  totalScore: number;
  rank: number;
  memberCount: number;
}

export interface AgentStandings {
  entryId: string;
  userId: string;
  userName: string;
  score: number;
  rank: number;
  isCurrentUser: boolean;
}

export interface AchievementSummary {
  ruleId: string;
  ruleTitle: string;
  totalPoints: number;
  completionCount: number;
}

export const competitionStandingsRepository = {
  async getPodStandings(competitionId: string, podId?: string) {
    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      include: {
        entries: {
          include: {
            user: {
              include: {
                podMemberships: {
                  include: {
                    pod: {
                      include: {
                        memberships: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!competition) return [];

    // Group entries by pod
    const podScores = new Map<string, { podId: string; podName: string; totalScore: number; memberCount: number }>();

    for (const entry of competition.entries) {
      if (!entry.user) continue;

      const userPodMemberships = entry.user.podMemberships;
      
      for (const membership of userPodMemberships) {
        const existing = podScores.get(membership.podId);
        const memberCount = membership.pod.memberships?.length || 1;
        
        if (existing) {
          existing.totalScore += entry.score;
          existing.memberCount = Math.max(existing.memberCount, memberCount);
        } else {
          podScores.set(membership.podId, {
            podId: membership.podId,
            podName: membership.pod.name,
            totalScore: entry.score,
            memberCount,
          });
        }
      }
    }

    // If podId is provided, filter to that pod
    const standings = Array.from(podScores.values());
    const filtered = podId 
      ? standings.filter(s => s.podId === podId)
      : standings;

    // Sort by score descending and assign ranks
    return filtered
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((s, i) => ({ ...s, rank: i + 1 }));
  },

  async getTeamStandings(competitionId: string) {
    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      include: {
        teams: true,
        entries: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!competition) return [];

    // Get team bonus scores from score logs
    const teamBonusScores = await prisma.competitionScoreLog.groupBy({
      by: ['bonusTeamId'],
      where: {
        entry: { competitionId },
        isBonus: true,
        bonusTeamId: { not: null },
      },
      _sum: { value: true },
    });

    const bonusMap = new Map<string, number>();
    for (const bonus of teamBonusScores) {
      if (bonus.bonusTeamId) {
        bonusMap.set(bonus.bonusTeamId, bonus._sum.value || 0);
      }
    }

    // Group entries by team (we need to track which team each user belongs to)
    // For now, we'll create team scores based on members
    const teamScores = new Map<string, { teamId: string; teamName: string; totalScore: number }>();

    for (const team of competition.teams) {
      teamScores.set(team.id, {
        teamId: team.id,
        teamName: team.name,
        totalScore: bonusMap.get(team.id) || 0,
      });
    }

    // In a real implementation, we'd need to link users to teams
    // For now, return the teams with their bonus scores
    const standings = Array.from(teamScores.values());

    return standings
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((s, i) => ({ ...s, rank: i + 1, memberCount: 0 }));
  },

  async getAgentStandings(competitionId: string, currentUserId?: string, limit = 20) {
    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      include: {
        entries: {
          where: { userId: { not: null } },
          include: {
            user: true,
          },
        },
      },
    });

    if (!competition) return [];

    const standings = competition.entries
      .filter(e => e.user)
      .map(entry => ({
        entryId: entry.id,
        userId: entry.userId!,
        userName: entry.user!.name,
        score: entry.score,
        isCurrentUser: entry.userId === currentUserId,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    return standings;
  },

  async getAchievementSummary(competitionId: string) {
    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      include: {
        rules: true,
        entries: {
          include: {
            scoreLogs: true,
          },
        },
      },
    });

    if (!competition) return [];

    const summaries: AchievementSummary[] = [];

    for (const rule of competition.rules) {
      const ruleLogs = competition.entries.flatMap(e => 
        e.scoreLogs.filter(log => log.ruleId === rule.id)
      );

      summaries.push({
        ruleId: rule.id,
        ruleTitle: rule.title,
        totalPoints: ruleLogs.reduce((sum, log) => sum + log.value, 0),
        completionCount: ruleLogs.length,
      });
    }

    return summaries;
  },

  async getTotalScores(competitionId: string) {
    const entries = await prisma.competitionEntry.findMany({
      where: { competitionId },
      select: { score: true },
    });

    return entries.reduce((sum, e) => sum + e.score, 0);
  },
};
