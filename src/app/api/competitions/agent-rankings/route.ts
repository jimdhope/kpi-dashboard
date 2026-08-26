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
    const competitionIdParam = url.searchParams.get('competitionId');

    if (podIds.length === 0) {
      return ok({ rankings: [], competitionName: null, competitionId: null });
    }

    // Resolve the competition whose standings drive the round robin.
    // Prefer an explicit selection (caller picks from the dropdown); otherwise
    // fall back to the most recent competition by start date — which now
    // INCLUDES a currently-running competition (previously the endpoint
    // excluded it via `endsAt < now`, so "this week's" scores were ignored).
    let competition: { id: string; name: string } | null = null;
    if (competitionIdParam) {
      const found = await prisma.competition.findUnique({
        where: { id: competitionIdParam },
        select: { id: true, name: true, isDraft: true },
      });
      competition = found && !found.isDraft ? found : null;
    }
    if (!competition) {
      competition = await prisma.competition.findFirst({
        where: { isDraft: false },
        orderBy: { startsAt: 'desc' },
        select: { id: true, name: true },
      });
    }

    if (!competition) {
      return ok({ rankings: [], competitionName: null, competitionId: null });
    }

    // The ledger snapshots historical pod membership, so transfers do not
    // rewrite who was represented in an already completed competition.
    const standings = await scoreEventProjectionService.getCompetitionStandings({
      competitionId: competition.id,
      podIds,
    });
    const rankings = standings.map(({ agentId, points }) => ({ agentId, score: points }));

    return ok({
      rankings,
      competitionName: competition.name,
      competitionId: competition.id,
    });
  } catch (error) {
    console.error('GET /api/competitions/agent-rankings error:', error);
    return errorResponse(401, "Unauthorized");
  }
}
