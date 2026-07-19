import "server-only";

import { scoreEventRepository } from "@/server/repositories/score-event-repository";
import { prisma } from "@/server/db/client";

export type CompetitionScoreStanding = {
  agentId: string;
  agentName: string | null;
  points: number;
  rank: number;
};

/**
 * Read-side projection for the canonical score ledger. No route uses this yet;
 * it is introduced before dashboard cutover so it can be compared to legacy
 * projections independently.
 */
export const scoreEventProjectionService = {
  async getCompetitionStandings(input: {
    competitionId: string;
    podIds?: string[];
    start?: Date;
    end?: Date;
  }): Promise<CompetitionScoreStanding[]> {
    const totals = await scoreEventRepository.getActiveTotalsByCompetition({
      competitionId: input.competitionId,
      podIds: input.podIds,
      scoredForDate: { gte: input.start, lte: input.end },
    });
    const agentIds = totals.map((total) => total.subjectAgentId);
    const users = agentIds.length
      ? await prisma.user.findMany({
          where: { id: { in: agentIds } },
          select: { id: true, name: true },
        })
      : [];
    const namesById = new Map(users.map((user) => [user.id, user.name]));

    return totals
      .sort((a, b) => b.points - a.points || a.subjectAgentId.localeCompare(b.subjectAgentId))
      .map((total, index, rankings) => ({
        agentId: total.subjectAgentId,
        agentName: namesById.get(total.subjectAgentId) ?? null,
        points: total.points,
        rank: index === 0 || rankings[index - 1].points !== total.points
          ? index + 1
          : rankings.findIndex((standing) => standing.points === total.points) + 1,
      }));
  },
};
