import { errorResponse, ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { prisma } from "@/server/db/client";

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
      include: { 
        rules: true,
        teams: true,
      },
    });
    
    if (!latestCompetition) {
      return ok({ rankings: [], competitionName: null });
    }
    
    // Get achievements for this competition from the specified pods
    const achievements = await prisma.dailyAchievement.findMany({
      where: {
        competitionId: latestCompetition.id,
        podId: { in: podIds },
      },
    });
    
    // Aggregate scores by agent
    const agentScores: Record<string, number> = {};
    achievements.forEach(a => {
      agentScores[a.agentId] = (agentScores[a.agentId] || 0) + (a.points || 0);
    });
    
    // Sort by score descending
    const rankings = Object.entries(agentScores)
      .map(([agentId, score]) => ({ agentId, score }))
      .sort((a, b) => b.score - a.score);
    
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
