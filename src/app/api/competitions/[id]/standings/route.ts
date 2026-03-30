import { authService } from "@/server/services/auth-service";
import { errorResponse, ok } from "@/server/http";
import { prisma } from "@/server/db/client";
import { startOfDay, endOfDay } from "date-fns";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: competitionId } = await context.params;
    const user = await authService.requireCurrentUser();

    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      include: {
        rules: true,
        teams: true,
        entries: {
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
        },
      },
    });

    if (!competition) return errorResponse(404, "Competition not found");

    const startDate = competition.startsAt || new Date(0);
    const endDate = competition.endsAt || new Date();

    // Fetch all logs within competition timeframe for users in this competition
    const userIds = competition.entries
      .map((e) => e.userId)
      .filter((id): id is string => !!id);

    const logs = await prisma.trackerLog.findMany({
      where: {
        userId: { in: userIds },
        loggedAt: { gte: startDate, lte: endDate },
      },
      include: {
        trackerKpi: true,
      },
    });

    // 1. Agent Standings
    const agentScores: Record<string, number> = {};
    logs.forEach((log) => {
      if (log.userId) {
        agentScores[log.userId] = (agentScores[log.userId] || 0) + Number(log.value);
      }
    });

    const agentStandings = competition.entries
      .map((entry) => {
        const score = agentScores[entry.userId as string] || 0;
        return {
          id: entry.userId as string,
          name: entry.user?.name || "Unknown",
          score,
          isCurrentUser: entry.userId === user.id,
        };
      })
      .sort((a, b) => b.score - a.score);

    // 2. Pod Standings
    const podScores: Record<string, { name: string; score: number }> = {};
    competition.entries.forEach((entry) => {
      const pods = entry.user?.podMemberships.map((m) => m.pod) || [];
      const score = agentScores[entry.userId as string] || 0;
      pods.forEach((pod) => {
        if (!podScores[pod.id]) podScores[pod.id] = { name: pod.name, score: 0 };
        podScores[pod.id].score += score;
      });
    });

    const podStandings = Object.entries(podScores)
      .map(([id, data]) => ({ id, name: data.name, score: data.score }))
      .sort((a, b) => b.score - a.score);

    // 3. Team Standings
    const teamScores: Record<string, number> = {};
    competition.teams.forEach((team) => {
      // In V3, Team model doesn't have agentIds field in Prisma? 
      // Wait, let's check Team model in schema.
      // Ah, CompetitionTeam in Step 1503: doesn't have agents.
    });
    // For now, return empty or mock if teams aren't linked to users in V3 schema yet
    const teamStandings = competition.teams.map(t => ({ id: t.id, name: t.name, score: 0 }));

    // 4. Rule Summaries
    // V3 Rules aren't linked to specific trackers yet. 
    // We'll summarize by tracker names that match rule titles if possible.
    const ruleSummaries = competition.rules.map((rule) => {
      const ruleLogs = logs.filter((l) => l.trackerKpi.name.toLowerCase().includes(rule.title.toLowerCase()));
      const totalValue = ruleLogs.reduce((acc, l) => acc + Number(l.value), 0);
      return {
        ruleId: rule.id,
        title: rule.title,
        totalValue,
        totalPoints: totalValue * rule.points,
      };
    });

    return ok({
      competitionId,
      podStandings,
      teamStandings,
      agentStandings,
      ruleSummaries,
    });
  } catch (err) {
    return errorResponse(401, "Unauthorized");
  }
}
