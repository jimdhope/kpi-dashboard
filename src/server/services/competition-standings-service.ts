import { competitionStandingsRepository } from "@/server/repositories/competition-standings-repository";
import { competitionRepository } from "@/server/repositories/competition-repository";
import { authService } from "@/server/services/auth-service";

export const competitionStandingsService = {
  async getPodStandings(competitionId: string, podId?: string) {
    const competition = await competitionRepository.findById(competitionId);
    if (!competition) {
      throw new Error("Competition not found");
    }

    return competitionStandingsRepository.getPodStandings(competitionId, podId);
  },

  async getTeamStandings(competitionId: string) {
    const competition = await competitionRepository.findById(competitionId);
    if (!competition) {
      throw new Error("Competition not found");
    }

    return competitionStandingsRepository.getTeamStandings(competitionId);
  },

  async getAgentStandings(competitionId: string, limit = 20) {
    const competition = await competitionRepository.findById(competitionId);
    if (!competition) {
      throw new Error("Competition not found");
    }

    const session = await authService.getCurrentSession();
    const currentUserId = session.user?.id;

    return competitionStandingsRepository.getAgentStandings(competitionId, currentUserId, limit);
  },

  async getAchievementSummary(competitionId: string) {
    const competition = await competitionRepository.findById(competitionId);
    if (!competition) {
      throw new Error("Competition not found");
    }

    return competitionStandingsRepository.getAchievementSummary(competitionId);
  },

  async getDashboardData(competitionId: string) {
    const competition = await competitionRepository.findById(competitionId);
    if (!competition) {
      throw new Error("Competition not found");
    }

    const session = await authService.getCurrentSession();
    const currentUserId = session.user?.id;

    const [podStandings, teamStandings, agentStandings, achievements, totalScores] = await Promise.all([
      competitionStandingsRepository.getPodStandings(competitionId),
      competitionStandingsRepository.getTeamStandings(competitionId),
      competitionStandingsRepository.getAgentStandings(competitionId, currentUserId, 20),
      competitionStandingsRepository.getAchievementSummary(competitionId),
      competitionStandingsRepository.getTotalScores(competitionId),
    ]);

    return {
      competition: {
        id: competition.id,
        name: competition.name,
        description: competition.description,
        startsAt: competition.startsAt?.toISOString(),
        endsAt: competition.endsAt?.toISOString(),
        rules: competition.rules,
        teams: competition.teams,
      },
      podStandings,
      teamStandings,
      agentStandings,
      achievements,
      totalScores,
    };
  },
};
