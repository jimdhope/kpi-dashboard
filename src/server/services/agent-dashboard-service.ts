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
  async getData() {
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

    // Do not scan achievements belonging to drafts or competitions that the
    // dashboard cannot display.
    const achievements = await prisma.dailyAchievement.findMany({
      where: { competitionId: { in: competitions.map((competition) => competition.id) } },
      orderBy: { loggedAt: "desc" },
    });

    const agentIds = [...new Set(achievements.map((achievement) => achievement.agentId))];
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
      achievements: achievements.map((achievement) => ({
        ...achievement,
        agentName: agentNames.get(achievement.agentId) || "Unknown",
      })),
    };
  },
};
