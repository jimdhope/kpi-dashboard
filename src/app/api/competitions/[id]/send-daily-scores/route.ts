import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { authService } from "@/server/services/auth-service";
import { ok, errorResponse } from "@/server/http";
import { buildDailyScoresAdaptiveCard, DailyScoresCardData, PodStandingsForTeams, CompetitionTeamStanding } from "@/server/services/competition-teams-card-service";

interface PodWithWebhook {
  id: string;
  name: string;
  outgoingWebhookId: string | null;
  outgoingWebhook: {
    id: string;
    url: string;
    isActive: boolean;
  } | null;
}

interface AgentScoreLog {
  ruleId: string | null;
  ruleEmoji: string | null;
  ruleTitle: string | null;
  value: number;
  isBonus: boolean;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await authService.getCurrentSession();
    const userRoles = session.user?.roles || [];
    const isAuthorized = userRoles.includes('admin') || userRoles.includes('teamLeader') || userRoles.includes('podManager');
    if (!session.user || !isAuthorized) {
      return errorResponse(403, "Forbidden");
    }

    const { id: competitionId } = await params;
    const body = await request.json();
    const { date, podIds } = body as { date: string; podIds: string[] };

    if (!date || !podIds || !Array.isArray(podIds)) {
      return errorResponse(400, "Invalid request: date and podIds are required");
    }

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
            scoreLogs: {
              include: {
                // Get rule info for emoji display
              },
            },
          },
        },
      },
    });

    if (!competition) {
      return errorResponse(404, "Competition not found");
    }

    // Get daily score logs with rule info
    const dateStart = new Date(`${date}T00:00:00.000Z`);
    const dateEnd = new Date(`${date}T23:59:59.999Z`);

    const scoreLogs = await prisma.competitionScoreLog.findMany({
      where: {
        loggedAt: {
          gte: dateStart,
          lt: dateEnd,
        },
        entry: {
          competitionId: competitionId,
        },
      },
      include: {
        entry: {
          include: {
            user: true,
          },
        },
      },
    });

    // Get rule info for score logs
    const ruleIds = [...new Set(scoreLogs.filter(l => l.ruleId).map(l => l.ruleId!))];
    const rules = await prisma.competitionRule.findMany({
      where: { id: { in: ruleIds } },
    });
    const ruleMap = new Map(rules.map(r => [r.id, r]));

    const pods = await prisma.pod.findMany({
      where: { id: { in: podIds } },
      include: {
        outgoingWebhook: true,
      },
    }) as PodWithWebhook[];

    // Build competition standings by team (using DAILY scores)
    const teamStandings: CompetitionTeamStanding[] = competition.teams.map(team => {
      const teamEntryIds = competition.entries
        .filter((entry: any) => entry.userId && team.agentIds.includes(entry.userId))
        .map((entry: any) => entry.id);

      // Calculate daily score for this team from score logs
      const teamDailyScore = scoreLogs
        .filter((log: any) => teamEntryIds.includes(log.entryId))
        .reduce((sum: number, log: any) => sum + log.value, 0);

      return {
        teamId: team.id,
        teamName: team.name,
        teamEmoji: team.emoji || '',
        totalScore: teamDailyScore, // Use daily score, not total
        memberCount: team.agentIds.length,
      };
    }).sort((a, b) => b.totalScore - a.totalScore);

    const sentTo: string[] = [];
    const failed: string[] = [];

    for (const pod of pods) {
      if (!pod.outgoingWebhook || !pod.outgoingWebhook.isActive) {
        failed.push(`${pod.name} - webhook not configured or inactive`);
        continue;
      }

      const agentsInPod = competition.entries.filter((entry: any) => {
        if (!entry.user) return false;
        return entry.user.podMemberships.some((m: any) => m.podId === pod.id);
      });

      const agentStandings = agentsInPod
        .map((entry: any) => {
          // Find which team this agent belongs to
          const agentTeam = competition.teams.find((team: any) => 
            team.agentIds.includes(entry.userId)
          );

          // Get score logs for this entry on this date
          const entryLogs = scoreLogs.filter(log => log.entryId === entry.id);
          
          // Calculate DAILY score from score logs (not total)
          const dailyScore = entryLogs.reduce((sum: number, log: any) => sum + log.value, 0);
          
          // Build emoji representation from score logs
          const scoreLogsForCard: AgentScoreLog[] = entryLogs.map((log: any) => {
            const rule = log.ruleId ? ruleMap.get(log.ruleId) : null;
            return {
              ruleId: log.ruleId,
              ruleEmoji: rule?.emoji || (log.isBonus ? '💰' : '📝'),
              ruleTitle: rule?.title || (log.isBonus ? 'Bonus' : 'Manual'),
              value: log.value,
              isBonus: log.isBonus,
            };
          });

          return {
            agentId: entry.userId!,
            agentName: entry.user!.name,
            teamEmoji: agentTeam?.emoji || '',
            teamName: agentTeam?.name || '',
            score: dailyScore, // Use daily score, not total score
            scoreLogs: scoreLogsForCard,
          };
        })
        .sort((a: any, b: any) => b.score - a.score)
        .map((standing: any, index: number) => ({
          ...standing,
          rank: index + 1,
        }));

      const podStandings: PodStandingsForTeams = {
        podId: pod.id,
        podName: pod.name,
        dailyTarget: null,
        agents: agentStandings,
        hasWebhook: !!pod.outgoingWebhook,
      };

      const cardData: DailyScoresCardData = {
        competitionName: competition.name,
        date: new Date(date).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        pods: [podStandings],
        teamStandings: teamStandings,
      };

      const card = buildDailyScoresAdaptiveCard(cardData);

      try {
        const response = await fetch(pod.outgoingWebhook.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(card),
        });

        if (response.ok || response.status === 200) {
          sentTo.push(pod.name);
        } else {
          failed.push(`${pod.name} - HTTP ${response.status}`);
        }
      } catch (err) {
        failed.push(`${pod.name} - ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    return ok({
      success: sentTo.length > 0,
      sentTo,
      failed,
      totalSent: sentTo.length,
      totalFailed: failed.length,
    });
  } catch (error) {
    console.error("POST /api/competitions/[id]/send-daily-scores error:", error);
    return errorResponse(500, "Failed to send daily scores to Teams");
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await authService.getCurrentSession();
    const userRoles = session.user?.roles || [];
    const isAuthorized = userRoles.includes('admin') || userRoles.includes('teamLeader') || userRoles.includes('podManager');
    if (!session.user || !isAuthorized) {
      return errorResponse(403, "Forbidden");
    }

    const { id: competitionId } = await params;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return errorResponse(400, "Date parameter is required");
    }

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
            scoreLogs: true,
          },
        },
      },
    });

    if (!competition) {
      return errorResponse(404, "Competition not found");
    }

    // Get daily score logs
    const dateStart = new Date(`${date}T00:00:00.000Z`);
    const dateEnd = new Date(`${date}T23:59:59.999Z`);

    const scoreLogs = await prisma.competitionScoreLog.findMany({
      where: {
        loggedAt: {
          gte: dateStart,
          lt: dateEnd,
        },
        entry: {
          competitionId: competitionId,
        },
      },
      include: {
        entry: true,
      },
    });

    // Get rule info
    const ruleIds = [...new Set(scoreLogs.filter(l => l.ruleId).map(l => l.ruleId!))];
    const rules = await prisma.competitionRule.findMany({
      where: { id: { in: ruleIds } },
    });
    const ruleMap = new Map(rules.map(r => [r.id, r]));

    const podsInCompetition = await prisma.pod.findMany({
      where: { id: { in: competition.podIds } },
      include: {
        outgoingWebhook: true,
      },
    }) as PodWithWebhook[];

    const podsWithAgents = podsInCompetition.map(pod => {
      const agentsInPod = competition.entries.filter((entry: any) => {
        if (!entry.user) return false;
        return entry.user.podMemberships.some((m: any) => m.podId === pod.id);
      });

      const agentStandings = agentsInPod
        .map((entry: any) => {
          const agentTeam = competition.teams.find((team: any) => 
            team.agentIds.includes(entry.userId)
          );
          const entryLogs = scoreLogs.filter((log: any) => log.entryId === entry.id);
          
          // Calculate DAILY score from score logs
          const dailyScore = entryLogs.reduce((sum: number, log: any) => sum + log.value, 0);
          
          const scoreLogsForCard: AgentScoreLog[] = entryLogs.map((log: any) => {
            const rule = log.ruleId ? ruleMap.get(log.ruleId) : null;
            return {
              ruleId: log.ruleId,
              ruleEmoji: rule?.emoji || (log.isBonus ? '💰' : '📝'),
              ruleTitle: rule?.title || (log.isBonus ? 'Bonus' : 'Manual'),
              value: log.value,
              isBonus: log.isBonus,
            };
          });

          return {
            agentId: entry.userId!,
            agentName: entry.user!.name,
            teamEmoji: agentTeam?.emoji || '',
            teamName: agentTeam?.name || '',
            score: dailyScore, // Use daily score, not total
            hasActivity: entryLogs.length > 0,
            scoreLogs: scoreLogsForCard,
          };
        })
        .sort((a: any, b: any) => b.score - a.score)
        .map((standing: any, index: number) => ({
          ...standing,
          rank: index + 1,
        }));

      return {
        podId: pod.id,
        podName: pod.name,
        dailyTarget: null,
        agents: agentStandings,
        hasWebhook: !!pod.outgoingWebhook && pod.outgoingWebhook.isActive,
        webhookConfigured: !!pod.outgoingWebhook,
        webhookActive: pod.outgoingWebhook?.isActive ?? false,
      };
    });

    // Build team standings (using DAILY scores)
    const teamStandings = competition.teams.map((team: any) => {
      const teamEntryIds = competition.entries
        .filter((entry: any) => entry.userId && team.agentIds.includes(entry.userId))
        .map((entry: any) => entry.id);
      
      // Calculate daily score from score logs
      const teamDailyScore = scoreLogs
        .filter((log: any) => teamEntryIds.includes(log.entryId))
        .reduce((sum: number, log: any) => sum + log.value, 0);
      
      return {
        teamId: team.id,
        teamName: team.name,
        teamEmoji: team.emoji || '',
        totalScore: teamDailyScore, // Use daily score, not total
        memberCount: team.agentIds.length,
      };
    }).sort((a: any, b: any) => b.totalScore - a.totalScore);

    return ok({ pods: podsWithAgents, teamStandings });
  } catch (error) {
    console.error("GET /api/competitions/[id]/send-daily-scores error:", error);
    return errorResponse(500, "Failed to get pod standings for Teams");
  }
}
