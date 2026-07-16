import { prisma } from "@/server/db/client";
import { podRepository } from "@/server/repositories/pod-repository";
import { userRepository } from "@/server/repositories/user-repository";
import { authService } from "@/server/services/auth-service";
import { competitionService } from "@/server/services/competition-service";
import { permissionService } from "@/server/services/permission-service";

export const managementDashboardService = {
  async getData() {
    const user = await authService.requireCurrentUser();
    const permissions = await permissionService.getPermissionsForRoles(user.roles);
    const hasAdminDataAccess = permissions["nav.settings"] === "MANAGE";
    if (!hasAdminDataAccess) throw new Error("Forbidden");
    const [competitions, pods, users] = await Promise.all([
      competitionService.listCompetitions(),
      hasAdminDataAccess ? podRepository.list() : podRepository.listForUser(user.id),
      hasAdminDataAccess ? userRepository.list() : userRepository.listByPodIds(user.podIds ?? []),
    ]);
    const now = new Date();
    const latestCompetition = competitions.find((competition) => {
      const startsAt = competition.startsAt ? new Date(competition.startsAt) : null;
      const endsAt = competition.endsAt ? new Date(competition.endsAt) : null;
      return startsAt && endsAt && startsAt <= now && endsAt >= now;
    }) ?? competitions[0];
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const achievements = await prisma.dailyAchievement.findMany({
      where: {
        OR: [
          { competitionId: latestCompetition?.id ?? "__none__" },
          { date: { gte: todayStart, lte: todayEnd } },
        ],
      },
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
