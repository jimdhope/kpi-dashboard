import { prisma } from "@/server/db/client";
import { kpiLogRepository } from "@/server/repositories/kpi-log-repository";
import { kpiRepository } from "@/server/repositories/kpi-repository";
import { podRepository } from "@/server/repositories/pod-repository";
import { userRepository } from "@/server/repositories/user-repository";
import { authService } from "@/server/services/auth-service";
import { competitionService } from "@/server/services/competition-service";
import { dailyGameService } from "@/server/services/daily-game-service";
import { permissionService } from "@/server/services/permission-service";
import { rpsService } from "@/server/services/rps-service";

export const agentDashboardService = {
  async getData(requestedCompetitionId?: string | null) {
    const user = await authService.requireCurrentUser();
    const permissions = await permissionService.getPermissionsForRoles(user.roles);
    const hasAdminDataAccess = permissions["nav.settings"] === "MANAGE";
    const [competitions, pods, users, kpis, kpiLogs, rpsLeaderboard, dailyGames] = await Promise.all([
      competitionService.listCompetitions(),
      hasAdminDataAccess ? podRepository.list() : podRepository.listForUser(user.id),
      hasAdminDataAccess ? userRepository.list() : userRepository.listByPodIds(user.podIds ?? []),
      kpiRepository.list(),
      kpiLogRepository.listByUserId(user.id),
      rpsService.leaderboard(),
      dailyGameService.summaries(user.id),
    ]);

    const now = new Date();
    const selectedCompetition = competitions.find((competition) => competition.id === requestedCompetitionId)
      ?? competitions.find((competition) => {
        const startsAt = competition.startsAt ? new Date(competition.startsAt) : null;
        const endsAt = competition.endsAt ? new Date(competition.endsAt) : null;
        return startsAt && endsAt && startsAt <= now && endsAt >= now;
      })
      ?? competitions[0];
    const scoreEvents = await prisma.scoreEvent.findMany({
      where: { competitionId: selectedCompetition?.id ?? "__none__", voidedAt: null },
      orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
    });

    const agentIds = [...new Set(scoreEvents.map((event) => event.subjectAgentId))];
    const agents = await prisma.user.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true },
    });
    const agentNames = new Map(agents.map((agent) => [agent.id, agent.name]));

    return {
      user,
      competitions,
      pods,
      users,
      kpis,
      kpiLogs,
      rpsLeaderboard,
      dailyGames,
      achievementCompetitionId: selectedCompetition?.id ?? null,
      achievements: scoreEvents.map((event) => ({
        id: event.id,
        competitionId: event.competitionId,
        agentId: event.subjectAgentId,
        podId: event.podId,
        ruleId: event.ruleId,
        ruleName: event.ruleName,
        value: event.quantity,
        points: event.points,
        date: event.scoredForDate,
        loggedBy: event.recordedById,
        loggedAt: event.recordedAt,
        createdAt: event.createdAt,
        agentName: agentNames.get(event.subjectAgentId) || "Unknown",
      })),
    };
  },
};
