import { NextRequest } from "next/server";
import { prisma } from "@/server/db/client";
import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";
import { ok, errorResponse } from "@/server/http";
import { sendDailyScores } from "@/server/services/send-daily-scores-service";
import type { AgentScoreLog, PodWithWebhook } from "@/server/services/send-daily-scores-service";
import type { RuleTargetProgress } from "@/server/services/competition-teams-card-service";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return sendDailyScores(request, context);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await authService.getCurrentSession();
    const userRoles = session.user?.roles || [];
    const isAuthorized = await permissionService.hasNavAccess(userRoles, 'competitions', 'MANAGE');
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

    // Read the auditable score ledger, shaped for the existing card builder.
    const dayStart = new Date(date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const achievements = (await prisma.scoreEvent.findMany({
      where: {
        competitionId: competitionId,
        scoredForDate: {
          gte: dayStart,
          lte: dayEnd,
        },
        voidedAt: null,
      },
    })).map((event) => ({ ...event, agentId: event.subjectAgentId, value: event.quantity, date: event.scoredForDate }));

    // Get all agent user IDs from pod memberships (ALL agents in the pod, not just entries/achievements)
    const podMemberships = await prisma.podMembership.findMany({
      where: { podId: { in: competition.podIds } },
      include: { user: true },
    });
    const allAgentIds = [...new Set(podMemberships.map(m => m.userId))];

    // Build a map of agentId to agent name from pod memberships
    const agentNameMap = new Map<string, string>();
    for (const membership of podMemberships) {
      if (membership.userId && membership.user?.name) {
        agentNameMap.set(membership.userId, membership.user.name);
      }
    }

    // Also fetch agent names from users table for any agents not in memberships
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

    // Calculate rule targets for each pod (GET endpoint)
    const rulesWithTargetsGet = competition.rules.filter(r => r.dailyTarget && r.dailyTarget > 0);
    
    const podAgentMapGet = new Map<string, string[]>();
    for (const membership of podMemberships) {
      const podId = membership.podId;
      if (!podAgentMapGet.has(podId)) {
        podAgentMapGet.set(podId, []);
      }
      podAgentMapGet.get(podId)!.push(membership.userId);
    }

    const recordedAbsencesGet = await prisma.absence.findMany({
      where: { startsOn: { lte: dayEnd }, OR: [{ endsOn: null }, { endsOn: { gte: dayStart } }] },
      select: { userId: true, emoji: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
    const absenceEmojiMapGet = new Map<string, string>();
    for (const absence of recordedAbsencesGet) {
      if (absence.emoji && !absenceEmojiMapGet.has(absence.userId)) {
        absenceEmojiMapGet.set(absence.userId, absence.emoji);
      }
    }
    const absentAgentIdsGet = new Set(
      achievements
        .filter(a => a.ruleId === 'na' || a.ruleName === 'N/A')
        .map(a => a.agentId)
    );
    recordedAbsencesGet.forEach((absence) => absentAgentIdsGet.add(absence.userId));

    const podRuleTargetsMapGet = new Map<string, RuleTargetProgress[]>();
    for (const podId of competition.podIds) {
      const agentIds = podAgentMapGet.get(podId) || [];
      const presentAgentIds = agentIds.filter(id => !absentAgentIdsGet.has(id));
      const presentCount = presentAgentIds.length;

      const ruleTargets: RuleTargetProgress[] = rulesWithTargetsGet.map(rule => {
        const achieved = achievements
          .filter(a => a.ruleId === rule.id && presentAgentIds.includes(a.agentId))
          .reduce((sum, a) => sum + (a.value || 0), 0);
        
        const target = presentCount * (rule.dailyTarget || 0);

        return {
          emoji: rule.emoji || '📝',
          title: rule.title,
          achieved,
          target,
        };
      });

      podRuleTargetsMapGet.set(podId, ruleTargets);
    }

    // Get all entries with users for the competition
    const allEntries = competition.entries.filter((entry: any) => entry.user);

    // Get cumulative scores from all active ledger events for this competition.
    const allCompetitionAchievementsGet = (await prisma.scoreEvent.findMany({
      where: { competitionId: competitionId, voidedAt: null },
    })).map((event) => ({ ...event, agentId: event.subjectAgentId, value: event.quantity }));
    const allAchievementsMapGet = new Map<string, number>();
    for (const a of allCompetitionAchievementsGet) {
      const current = allAchievementsMapGet.get(a.agentId) || 0;
      allAchievementsMapGet.set(a.agentId, current + (a.points ?? a.value));
    }

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
          
          // Get cumulative score from ALL achievements
          const cumulativeScore = allAchievementsMapGet.get(agentId) || 0;
          
          // Use hybrid approach for emojis: prefer competition rules, fallback to title match
          const competitionRulesMap = new Map(
            competition.rules.map(r => [r.id, r])
          );
          
          const scoreLogsForCard: AgentScoreLog[] = agentAchievements.map((a: any) => {
            let rule = competitionRulesMap.get(a.ruleId);
            
            // Fallback: if no match by ID, try matching by title
            if (!rule && a.ruleName) {
              rule = competition.rules.find((r: any) => r.title === a.ruleName);
            }
            
            const rawEmoji = rule?.emoji || '📝';
            const sanitizedEmoji = rawEmoji?.normalize('NFC') || '📝';
            return {
              ruleId: a.ruleId,
              ruleEmoji: sanitizedEmoji,
              ruleTitle: a.ruleName || rule?.title || 'Activity',
              value: a.value,
              isBonus: false,
            };
          });

          return {
            agentId: agentId,
            agentName: agentName,
            absenceEmoji: absenceEmojiMapGet.get(agentId),
            teamEmoji: agentTeam?.emoji || '',
            teamName: agentTeam?.name || '',
            score: cumulativeScore,
            dailyScore: agentAchievements.reduce((sum, a) => sum + (a.points ?? a.value), 0),
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
        ruleTargets: podRuleTargetsMapGet.get(pod.id) || [],
        agents: agentStandings,
        hasWebhook: !!pod.outgoingWebhook && pod.outgoingWebhook.isActive,
        webhookConfigured: !!pod.outgoingWebhook,
        webhookActive: pod.outgoingWebhook?.isActive ?? false,
      };
    });

    // Build team standings (using CUMULATIVE scores from ALL achievements)
    const teamStandings = competition.teams.map((team: any) => {
      // Sum ALL achievements for team members
      const teamCumulativeScore = allCompetitionAchievementsGet
        .filter((a: any) => team.agentIds.includes(a.agentId))
        .reduce((sum: number, a: any) => sum + (a.points ?? a.value), 0);
      
      return {
        teamId: team.id,
        teamName: team.name,
        teamEmoji: team.emoji || '',
        totalScore: teamCumulativeScore,
        memberCount: team.agentIds.length,
      };
    }).sort((a: any, b: any) => b.totalScore - a.totalScore);

    return ok({ pods: podsWithAgents, teamStandings });
  } catch (error) {
    console.error("GET /api/competitions/[id]/send-daily-scores error:", error);
    return errorResponse(500, "Failed to get pod standings for Teams");
  }
}
