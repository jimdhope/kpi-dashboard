import { prisma } from "@/server/db/client";
import { authService } from "@/server/services/auth-service";
import { competitionService } from "@/server/services/competition-service";
import { dailyGameService } from "@/server/services/daily-game-service";
import { kpiLogService } from "@/server/services/kpi-log-service";
import { kpiService } from "@/server/services/kpi-service";
import { podService } from "@/server/services/pod-service";
import { rpsService } from "@/server/services/rps-service";
import { userService } from "@/server/services/user-service";

export const agentDashboardService = {
  async getData() {
    const user = await authService.requireCurrentUser();
    const [competitions, pods, users, kpis, kpiLogs, rpsLeaderboard, dailyGames, achievements] = await Promise.all([
      competitionService.listCompetitions(),
      podService.listPods(),
      userService.listUsers(),
      kpiService.list(),
      kpiLogService.list({ userId: user.id }),
      rpsService.leaderboard(),
      dailyGameService.summaries(user.id),
      prisma.dailyAchievement.findMany({ orderBy: { loggedAt: "desc" } }),
    ]);

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
