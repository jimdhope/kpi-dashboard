import { errorResponse, ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { prisma } from "@/server/db/client";
import { scoreEventProjectionService } from "@/server/services/score-event-projection-service";

export async function GET(request: Request) {
  try {
    await authService.requireCurrentUser();
    
    const url = new URL(request.url);
    const podIdsParam = url.searchParams.get('podIds');
    const podIds = podIdsParam ? podIdsParam.split(',').filter(Boolean) : [];
    
    if (podIds.length === 0) {
      return ok({ rankings: [], competitionName: null });
    }
    
    // Find the most recent completed competition by start date
    // (user sets up next competition at end of day of last competition)
    const latestCompetition = await prisma.competition.findFirst({
      where: { 
        isDraft: false,
        endsAt: { lt: new Date() }, // Completed
      },
      orderBy: { startsAt: 'desc' },
    });
    
    if (!latestCompetition) {
      return ok({ rankings: [], competitionName: null });
    }
    
    // The ledger snapshots historical pod membership, so transfers do not
    // rewrite who was represented in an already completed competition.
    const standings = await scoreEventProjectionService.getCompetitionStandings({
      competitionId: latestCompetition.id,
      podIds,
    });
    const rankings = standings.map(({ agentId, points }) => ({ agentId, score: points }));
    
    return ok({ 
      rankings, 
      competitionName: latestCompetition.name,
      competitionId: latestCompetition.id,
    });
  } catch (error) {
    console.error('GET /api/competitions/agent-rankings error:', error);
    return errorResponse(401, "Unauthorized");
  }
}
