import { prisma } from "@/server/db/client";
import { podRepository } from "@/server/repositories/pod-repository";
import { userRepository } from "@/server/repositories/user-repository";
import { authService } from "@/server/services/auth-service";
import { competitionService } from "@/server/services/competition-service";
import { permissionService } from "@/server/services/permission-service";

export const managementDashboardService = {
  async getData() {
    const user = await authService.requireCurrentUser();
    if (!user.roles.some((role) => role !== "agent")) throw new Error("Forbidden");

    const permissions = await permissionService.getPermissionsForRoles(user.roles);
    const hasAdminDataAccess = permissions["nav.settings"] === "MANAGE";
    const [competitions, pods, users] = await Promise.all([
      competitionService.listCompetitions(),
      hasAdminDataAccess ? podRepository.list() : podRepository.listForUser(user.id),
      hasAdminDataAccess ? userRepository.list() : userRepository.listByPodIds(user.podIds ?? []),
    ]);
    const achievements = await prisma.dailyAchievement.findMany({
      where: { competitionId: { in: competitions.map((competition) => competition.id) } },
      orderBy: { loggedAt: "desc" },
    });
    const agentIds = [...new Set(achievements.map((achievement) => achievement.agentId))];
    const agents = await prisma.user.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true },
    });
    const names = new Map(agents.map((agent) => [agent.id, agent.name]));

    return {
      competitions,
      pods,
      users,
      achievements: achievements.map((achievement) => ({
        ...achievement,
        agentName: names.get(achievement.agentId) || "Unknown",
      })),
    };
  },
};
