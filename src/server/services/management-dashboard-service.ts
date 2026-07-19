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
    const scoreEvents = await prisma.scoreEvent.findMany({
      where: {
        voidedAt: null,
        OR: [
          { competitionId: latestCompetition?.id ?? "__none__" },
          { scoredForDate: { gte: todayStart, lte: todayEnd } },
        ],
      },
      orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
    });
    const agentIds = [...new Set(scoreEvents.map((event) => event.subjectAgentId))];
    const agents = await prisma.user.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true },
    });
    const names = new Map(agents.map((agent) => [agent.id, agent.name]));

    return {
      competitions,
      pods,
      users,
      achievements: scoreEvents.map((event) => ({
        id: event.id, competitionId: event.competitionId, agentId: event.subjectAgentId, podId: event.podId,
        ruleId: event.ruleId, ruleName: event.ruleName, value: event.quantity, points: event.points,
        date: event.scoredForDate, loggedBy: event.recordedById, loggedAt: event.recordedAt, createdAt: event.createdAt,
        agentName: names.get(event.subjectAgentId) || "Unknown",
      })),
    };
  },
};
