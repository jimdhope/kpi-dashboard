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
    const { date, podIds, tableFormat } = body as { date: string; podIds: string[]; tableFormat?: 'combined' | 'separate' };

    if (!date || !podIds || !Array.isArray(podIds)) {
      return errorResponse(400, "Invalid request: date and podIds are required");
    }

    // Default to 'separate'
    const format = tableFormat || 'separate';

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

    // Get daily achievements (the actual data from the log page)
    const dayStart = new Date(date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const achievements = await prisma.dailyAchievement.findMany({
      where: {
        competitionId: competitionId,
        date: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    });

    // Get all agent user IDs from achievements and competition entries
    const agentIdsFromEntries = competition.entries
      .filter((e: any) => e.userId)
      .map((e: any) => e.userId as string);
    const agentIdsFromAchievements = achievements.map(a => a.agentId);
    const allAgentIds = [...new Set([...agentIdsFromEntries, ...agentIdsFromAchievements])];

    // Build a map of agentId to agent name from competition entries
    const agentNameMap = new Map<string, string>();
    for (const entry of competition.entries) {
      if (entry.userId && entry.user?.name) {
        agentNameMap.set(entry.userId, entry.user.name);
      }
    }

    // Also fetch agent names from users table for any agents not in entries
    const missingAgentIds = allAgentIds.filter(id => !agentNameMap.has(id));
    
    if (missingAgentIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: missingAgentIds } },
        select: { id: true, name: true },
      });
      for (const user of users) {
        agentNameMap.set(user.id, user.name);
      }
    }

    // Get rule info for achievements
    const ruleIds = [...new Set(achievements.map(a => a.ruleId).filter(Boolean))];
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

    // Build competition standings by team (using DAILY scores from achievements)
    const teamStandings: CompetitionTeamStanding[] = competition.teams.map(team => {
      // Calculate daily score for this team from achievements
      const teamDailyScore = achievements
        .filter(a => team.agentIds.includes(a.agentId))
        .reduce((sum: number, a) => sum + (a.points ?? a.value), 0);

      return {
        teamId: team.id,
        teamName: team.name,
        teamEmoji: team.emoji || '',
        totalScore: teamDailyScore,
        memberCount: team.agentIds.length,
      };
    }).sort((a, b) => b.totalScore - a.totalScore);

    const sentTo: string[] = [];
    const failed: string[] = [];
    const allPodStandings: PodStandingsForTeams[] = [];

    // Get all entries with users for the competition
    const allEntries = competition.entries.filter((entry: any) => entry.user);

    for (const pod of pods) {
      if (!pod.outgoingWebhook || !pod.outgoingWebhook.isActive) {
        failed.push(`${pod.name} - webhook not configured or inactive`);
        continue;
      }

      // Show agents from achievements (and entries if they exist)
      const agentStandings = allAgentIds
        .map((agentId: string) => {
          // Use agentNameMap for name lookup (handles agents not in entries)
          const agentName = agentNameMap.get(agentId) || 'Unknown Agent';
          
          // Find which team this agent belongs to
          const agentTeam = competition.teams.find((team: any) => 
            team.agentIds.includes(agentId)
          );

          // Get achievements for this agent on this date
          const agentAchievements = achievements.filter(a => a.agentId === agentId);
          
          // Calculate DAILY score from achievements
          const dailyScore = agentAchievements.reduce(
            (sum: number, a) => sum + (a.points ?? a.value), 
            0
          );
          
          // Build emoji representation from achievements
          const scoreLogsForCard: AgentScoreLog[] = agentAchievements.map((a: any) => {
            const rule = a.ruleId ? ruleMap.get(a.ruleId) : null;
            return {
              ruleId: a.ruleId,
              ruleEmoji: rule?.emoji || '📝',
              ruleTitle: a.ruleName || rule?.title || 'Activity',
              value: a.value,
              isBonus: false,
            };
          });

          return {
            agentId: agentId,
            agentName: agentName,
            teamEmoji: agentTeam?.emoji || '',
            teamName: agentTeam?.name || '',
            score: dailyScore,
            scoreLogs: scoreLogsForCard,
          };
        })
        .sort((a: any, b: any) => a.agentName.localeCompare(b.agentName))
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

      // For combined format, collect all pod standings for later processing
      if (format === 'combined') {
        allPodStandings.push(podStandings);
      } else {
        // Separate format - build and send card immediately for each pod
        // Hide pod name if there's only one pod in the competition
        const hidePodName = podIds.length === 1;
        
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
          hidePodName,
        };

        const card = buildDailyScoresAdaptiveCard(cardData);

        // Send immediately
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
    }

    // Handle combined format - build single card with all agents and send to all pods
    if (format === 'combined' && allPodStandings.length > 0) {
      // Combine all agents from all pods into one list sorted alphabetically
      const allAgents = allPodStandings
        .flatMap((p: PodStandingsForTeams) => p.agents)
        .sort((a: any, b: any) => a.agentName.localeCompare(b.agentName))
        .map((agent: any, index: number) => ({ ...agent, rank: index + 1 }));

      const combinedPodStandings: PodStandingsForTeams = {
        podId: 'combined',
        podName: 'All Pods',
        dailyTarget: null,
        agents: allAgents,
        hasWebhook: true,
      };

      const cardData: DailyScoresCardData = {
        competitionName: competition.name,
        date: new Date(date).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        pods: [combinedPodStandings],
        teamStandings: teamStandings,
        hidePodName: true,
      };

      const combinedCard = buildDailyScoresAdaptiveCard(cardData);

      // Send combined card to all pods
      for (const pod of pods) {
        if (!pod.outgoingWebhook || !pod.outgoingWebhook.isActive) {
          failed.push(`${pod.name} - webhook not configured or inactive`);
          continue;
        }

        try {
          const response = await fetch(pod.outgoingWebhook.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(combinedCard),
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

    // Get daily achievements (the actual data from the log page)
    const dayStart = new Date(date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const achievements = await prisma.dailyAchievement.findMany({
      where: {
        competitionId: competitionId,
        date: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    });

    // Get all agent user IDs from achievements and competition entries
    const agentIdsFromEntries = competition.entries
      .filter((e: any) => e.userId)
      .map((e: any) => e.userId as string);
    const agentIdsFromAchievements = achievements.map(a => a.agentId);
    const allAgentIds = [...new Set([...agentIdsFromEntries, ...agentIdsFromAchievements])];

    // Build a map of agentId to agent name
    const agentNameMap = new Map<string, string>();
    for (const entry of competition.entries) {
      if (entry.userId && entry.user?.name) {
        agentNameMap.set(entry.userId, entry.user.name);
      }
    }

    // Also fetch agent names from users table for any agents not in entries
    const missingAgentIds = allAgentIds.filter(id => !agentNameMap.has(id));
    if (missingAgentIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: missingAgentIds } },
        select: { id: true, name: true },
      });
      for (const user of users) {
        agentNameMap.set(user.id, user.name);
      }
    }

    // Get rule info
    const ruleIds = [...new Set(achievements.map(a => a.ruleId).filter(Boolean))];
    const rules = await prisma.competitionRule.findMany({
      where: { id: { in: ruleIds } },
    });
    const ruleMap = new Map(rules.map(r => [r.id, r]));

    // Get all entries with users for the competition
    const allEntries = competition.entries.filter((entry: any) => entry.user);

    const podsInCompetition = await prisma.pod.findMany({
      where: { id: { in: competition.podIds } },
      include: {
        outgoingWebhook: true,
      },
    }) as PodWithWebhook[];

    const podsWithAgents = podsInCompetition.map(pod => {
      // Show agents who have achievements or are in competition entries
      const agentStandings = allAgentIds
        .map((agentId: string) => {
          const agentName = agentNameMap.get(agentId) || 'Unknown Agent';
          const agentTeam = competition.teams.find((team: any) => 
            team.agentIds.includes(agentId)
          );
          const agentAchievements = achievements.filter((a: any) => a.agentId === agentId);
          
          // Calculate DAILY score from achievements
          const dailyScore = agentAchievements.reduce(
            (sum: number, a: any) => sum + (a.points ?? a.value), 
            0
          );
          
          const scoreLogsForCard: AgentScoreLog[] = agentAchievements.map((a: any) => {
            const rule = a.ruleId ? ruleMap.get(a.ruleId) : null;
            return {
              ruleId: a.ruleId,
              ruleEmoji: rule?.emoji || '📝',
              ruleTitle: a.ruleName || rule?.title || 'Activity',
              value: a.value,
              isBonus: false,
            };
          });

          return {
            agentId: agentId,
            agentName: agentName,
            teamEmoji: agentTeam?.emoji || '',
            teamName: agentTeam?.name || '',
            score: dailyScore,
            hasActivity: agentAchievements.length > 0,
            scoreLogs: scoreLogsForCard,
          };
        })
        .sort((a: any, b: any) => a.agentName.localeCompare(b.agentName))
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

    // Build team standings (using DAILY scores from achievements)
    const teamStandings = competition.teams.map((team: any) => {
      // Calculate daily score from achievements
      const teamDailyScore = achievements
        .filter((a: any) => team.agentIds.includes(a.agentId))
        .reduce((sum: number, a: any) => sum + (a.points ?? a.value), 0);
      
      return {
        teamId: team.id,
        teamName: team.name,
        teamEmoji: team.emoji || '',
        totalScore: teamDailyScore,
        memberCount: team.agentIds.length,
      };
    }).sort((a: any, b: any) => b.totalScore - a.totalScore);

    return ok({ pods: podsWithAgents, teamStandings });
  } catch (error) {
    console.error("GET /api/competitions/[id]/send-daily-scores error:", error);
    return errorResponse(500, "Failed to get pod standings for Teams");
  }
}