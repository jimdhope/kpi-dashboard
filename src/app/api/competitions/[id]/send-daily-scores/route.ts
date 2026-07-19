import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";
import { ok, errorResponse } from "@/server/http";
import { buildDailyScoresAdaptiveCard, DailyScoresCardData, PodStandingsForTeams, CompetitionTeamStanding, RuleTargetProgress } from "@/server/services/competition-teams-card-service";
import { requireManagedPod } from "@/server/services/organization-scope-service";

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

async function sendDailyScores(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  skipAuthorization = false,
) {
  try {
    let authorizedUser: { id: string; roles: string[] } | null = null;
    if (!skipAuthorization) {
      const session = await authService.getCurrentSession();
      const userRoles = session.user?.roles || [];
      const isAuthorized = await permissionService.hasNavAccess(userRoles, 'competitions', 'MANAGE');
      if (!session.user || !isAuthorized) {
        return errorResponse(403, "Forbidden");
      }
      authorizedUser = session.user;
    }

    const { id: competitionId } = await params;
    const body = await request.json();
    const { date, podIds, tableFormat } = body as { date: string; podIds: string[]; tableFormat?: 'combined' | 'separate' };

    if (!date || !podIds || !Array.isArray(podIds)) {
      return errorResponse(400, "Invalid request: date and podIds are required");
    }
    if (authorizedUser) {
      for (const podId of podIds) await requireManagedPod(authorizedUser, podId, "competitions");
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
      where: { podId: { in: podIds } },
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

    // Calculate rule targets for each pod
    // Target = (number of non-absent agents) × rule.dailyTarget
    const rulesWithTargets = competition.rules.filter(r => r.dailyTarget && r.dailyTarget > 0);
    
    // For each pod, get the agent IDs and identify absent agents
    const podAgentMap = new Map<string, string[]>();
    for (const membership of podMemberships) {
      const podId = membership.podId;
      if (!podAgentMap.has(podId)) {
        podAgentMap.set(podId, []);
      }
      podAgentMap.get(podId)!.push(membership.userId);
    }

    // Find absent agents from either the score log's N/A marker or a recorded
    // date-range absence. Both reduce that day's target only.
    const recordedAbsences = await prisma.absence.findMany({
      where: { startsOn: { lte: dayEnd }, OR: [{ endsOn: null }, { endsOn: { gte: dayStart } }] },
      select: { userId: true },
    });
    const absentAgentIds = new Set(
      achievements
        .filter(a => a.ruleId === 'na' || a.ruleName === 'N/A')
        .map(a => a.agentId)
    );
    recordedAbsences.forEach((absence) => absentAgentIds.add(absence.userId));

    // Build rule targets for each pod
    const podRuleTargetsMap = new Map<string, RuleTargetProgress[]>();
    for (const podId of podIds) {
      const agentIds = podAgentMap.get(podId) || [];
      const presentAgentIds = agentIds.filter(id => !absentAgentIds.has(id));
      const presentCount = presentAgentIds.length;

      const ruleTargets: RuleTargetProgress[] = rulesWithTargets.map(rule => {
        // Sum achievements for this rule from present agents only
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

      podRuleTargetsMap.set(podId, ruleTargets);
    }

    // Build competition standings by team from all active ledger events.
    const allCompetitionAchievements = (await prisma.scoreEvent.findMany({
      where: { competitionId: competitionId, voidedAt: null },
    })).map((event) => ({ ...event, agentId: event.subjectAgentId, value: event.quantity }));
    
    const teamStandings: CompetitionTeamStanding[] = competition.teams.map(team => {
      // Sum ALL achievements for team members
      const teamCumulativeScore = allCompetitionAchievements
        .filter(a => team.agentIds.includes(a.agentId))
        .reduce((sum: number, a) => sum + (a.points ?? a.value), 0);

      return {
        teamId: team.id,
        teamName: team.name,
        teamEmoji: team.emoji || '',
        totalScore: teamCumulativeScore,
        memberCount: team.agentIds.length,
      };
    }).sort((a, b) => b.totalScore - a.totalScore);

    const sentTo: string[] = [];
    const failed: string[] = [];
    const allPodStandings: PodStandingsForTeams[] = [];

    // Get all entries with users for the competition (may be empty)
    const allEntries = competition.entries.filter((entry: any) => entry.user);

    // Get cumulative scores from ALL achievements (not just today's)
    const allAchievementsMap = new Map<string, number>();
    for (const a of allCompetitionAchievements) {
      const current = allAchievementsMap.get(a.agentId) || 0;
      allAchievementsMap.set(a.agentId, current + (a.points ?? a.value));
    }

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

          // Get cumulative score from ALL achievements for this competition
          const cumulativeScore = allAchievementsMap.get(agentId) || 0;

          // Get achievements for emoji display
          const agentAchievements = achievements.filter(a => a.agentId === agentId);

          // Build emoji representation - hybrid: prefer competition rules, fallback to achievement data
          // This ensures most emojis match competition, but handles historical achievements
          const competitionRulesMap = new Map(
            competition.rules.map(r => [r.id, r])
          );
          
          const scoreLogsForCard: AgentScoreLog[] = agentAchievements.map((a: any) => {
            // First try to find rule by ID in competition rules
            let rule = competitionRulesMap.get(a.ruleId);
            
            // Fallback: if no match by ID, try matching by title
            if (!rule && a.ruleName) {
              rule = competition.rules.find((r: any) => r.title === a.ruleName);
            }
            
            // Final fallback: use emoji stored in the achievement itself
            const rawEmoji = rule?.emoji || a.ruleEmoji || '📝';
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
            teamEmoji: agentTeam?.emoji || '',
            teamName: agentTeam?.name || '',
            score: cumulativeScore,
            dailyScore: achievements
              .filter(a => a.agentId === agentId)
              .reduce((sum, a) => sum + (a.points ?? a.value), 0),
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
        ruleTargets: podRuleTargetsMap.get(pod.id) || [],
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
        
        // Get competition rules for the emoji key
        const competitionRulesForCard = competition.rules.map(r => ({
          id: r.id,
          emoji: r.emoji || '📝',
          title: r.title,
        }));
        
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
          competitionRules: competitionRulesForCard,
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
        ruleTargets: [],
        agents: allAgents,
        hasWebhook: true,
      };

      // Get competition rules for the emoji key
      const competitionRulesForCard = competition.rules.map(r => ({
        id: r.id,
        emoji: r.emoji || '📝',
        title: r.title,
      }));

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
        competitionRules: competitionRulesForCard,
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

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return sendDailyScores(request, context);
}

/** In-process entry point for the trusted background worker. */
export async function sendDailyScoresFromWorker(request: NextRequest, competitionId: string) {
  return sendDailyScores(request, { params: Promise.resolve({ id: competitionId }) }, true);
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
      select: { userId: true },
    });
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
