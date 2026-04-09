import { prisma } from "@/server/db/client";

export interface CertificateData {
  competitionId: string;
  competitionName: string;
  rank: number;
  userName: string;
  score: number;
  podName?: string;
  teamName?: string;
  dateRange?: string;
}

export const certificateRepository = {
  async getTopAgents(competitionId: string, limit = 3, podId?: string) {
    const entries = await prisma.competitionEntry.findMany({
      where: {
        competitionId,
        userId: { not: null },
      },
      include: {
        user: {
          include: {
            podMemberships: {
              include: {
                pod: true,
              },
            },
          },
        },
      },
      orderBy: { score: 'desc' },
      take: limit * 3, // Get more to filter by pod if needed
    });

    let filtered = entries;
    if (podId) {
      filtered = entries.filter(e => 
        e.user?.podMemberships.some(m => m.podId === podId)
      );
    }

    return filtered.slice(0, limit).map((entry, index) => ({
      competitionId,
      competitionName: '',
      rank: index + 1,
      userName: entry.user?.name || 'Unknown',
      score: entry.score,
    }));
  },

  async getWinningTeam(competitionId: string) {
    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      include: { teams: true },
    });

    if (!competition || competition.teams.length === 0) {
      return null;
    }

    // Get team bonus scores
    const teamScores = await prisma.competitionScoreLog.groupBy({
      by: ['bonusTeamId'],
      where: {
        entry: { competitionId },
        isBonus: true,
        bonusTeamId: { not: null },
      },
      _sum: { value: true },
      orderBy: { _sum: { value: 'desc' } },
      take: 1,
    });

    if (teamScores.length === 0) {
      return {
        teamId: competition.teams[0].id,
        teamName: competition.teams[0].name,
        score: 0,
      };
    }

    const winnerId = teamScores[0].bonusTeamId;
    const winner = competition.teams.find(t => t.id === winnerId);

    return winner ? {
      teamId: winner.id,
      teamName: winner.name,
      score: teamScores[0]._sum.value || 0,
    } : null;
  },

  async getCompetitionDetails(competitionId: string) {
    return prisma.competition.findUnique({
      where: { id: competitionId },
      include: {
        teams: true,
        rules: true,
      },
    });
  },

  async getPodDetails(podId: string) {
    return prisma.pod.findUnique({
      where: { id: podId },
    });
  },

  async getAgentsByPod(competitionId: string, podId: string, limit = 3) {
    const entries = await prisma.competitionEntry.findMany({
      where: {
        competitionId,
        userId: { not: null },
      },
      include: {
        user: {
          include: {
            podMemberships: {
              where: { podId },
            },
          },
        },
      },
      orderBy: { score: 'desc' },
    });

    const inPod = entries.filter(e => (e.user?.podMemberships?.length ?? 0) > 0);

    return inPod.slice(0, limit).map((entry, index) => ({
      competitionId,
      competitionName: '',
      rank: index + 1,
      userName: entry.user?.name || 'Unknown',
      score: entry.score,
      podName: podId,
    }));
  },
};
