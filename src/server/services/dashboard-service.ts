import { DashboardSummary } from "@/lib/contracts";
import { prisma } from "@/server/db/client";
import { podRepository } from "@/server/repositories/pod-repository";
import { activityRepository } from "@/server/repositories/activity-repository";
import { trackerRepository } from "@/server/repositories/tracker-repository";
import { authService } from "@/server/services/auth-service";
import { competitionService } from "@/server/services/competition-service";
import { permissionService } from "@/server/services/permission-service";

export const dashboardService = {
  async getDashboard(): Promise<DashboardSummary> {
    const user = await authService.requireCurrentUser();
    const allPods = await podRepository.list();
    const isAdmin = await permissionService.hasEffectiveAdminAccess(user.roles);
    const assignedPods = isAdmin
      ? allPods
      : allPods.filter((pod) => pod.members.some((member) => member.id === user.id));
    const recentActivities = await activityRepository.listRecent(10);
    
    // Performance aggregation
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const kpiSummary = await prisma.trackerLog.aggregate({
      where: {
        userId: user.id,
        loggedAt: { gte: startOfToday },
      },
      _sum: { value: true },
    });

    // Competition Logic
    const activeComps = await prisma.competition.findMany({
      where: {
        startsAt: { lte: new Date() },
        endsAt: { gte: new Date() },
      },
      take: 1,
    });
    
    let leaderboard = null;
    if (activeComps[0]) {
      leaderboard = await competitionService.getLeaderboard(activeComps[0].id);
    }
    
    // Pod comparisons
    const podComparisons = await Promise.all(
      assignedPods.map(async (pod) => {
        const score = await trackerRepository.getPodDailySum(pod.id, new Date());
        return {
          id: pod.id,
          name: pod.name,
          dailyScore: score,
        };
      })
    );

    return {
      user,
      assignedPods,
      recentActivities,
      dailyKpiSum: kpiSummary._sum.value?.toNumber() || 0,
      podComparisons: podComparisons.sort((a, b) => b.dailyScore - a.dailyScore),
      leaderboard,
      metrics: isAdmin ? {
        campaigns: await prisma.campaign.count(),
        pods: await prisma.pod.count(),
        users: await prisma.user.count(),
      } : null,
    };
  },
};
