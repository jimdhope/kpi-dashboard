import { NotificationType, ReportsOverview } from "@/lib/contracts";
import { prisma } from "@/server/db/client";
import { competitionService } from "@/server/services/competition-service";
import { performanceService } from "@/server/services/performance-service";
import { requireAdminUser } from "@/server/services/authorization";

const notificationTypes: NotificationType[] = [
  "competition_reminder",
  "score_achievement",
  "team_update",
  "system_alert",
];

export const reportingService = {
  async getOverview(): Promise<ReportsOverview> {
    await requireAdminUser();

    const [
      campaigns,
      pods,
      memberships,
      users,
      trackers,
      performanceLogs,
      competitions,
      competitionEntries,
      notifications,
      unreadNotifications,
      performanceOverview,
      competitionSummaries,
      campaignRows,
    ] = await Promise.all([
      prisma.campaign.count(),
      prisma.pod.count(),
      prisma.podMembership.count(),
      prisma.user.count(),
      prisma.trackerKpi.count(),
      prisma.trackerLog.count(),
      prisma.competition.count(),
      prisma.competitionEntry.count(),
      prisma.notification.count(),
      prisma.notification.count({
        where: {
          readAt: null,
        },
      }),
      performanceService.getOverview(),
      competitionService.getSummaries(),
      prisma.campaign.findMany({
        select: {
          id: true,
          name: true,
          isActive: true,
          _count: {
            select: {
              pods: true,
              trackerKpis: true,
            },
          },
        },
        orderBy: {
          name: "asc",
        },
      }),
    ]);

    const notificationBreakdown = await Promise.all(
      notificationTypes.map(async (type) => {
        const [total, unread] = await Promise.all([
          prisma.notification.count({
            where: { type },
          }),
          prisma.notification.count({
            where: {
              type,
              readAt: null,
            },
          }),
        ]);

        return { type, total, unread };
      }),
    );

    return {
      generatedAt: new Date().toISOString(),
      metrics: {
        campaigns,
        activeCampaigns: campaignRows.filter((campaign) => campaign.isActive).length,
        pods,
        memberships,
        users,
        trackers,
        performanceLogs,
        competitions,
        competitionEntries,
        notifications,
        unreadNotifications,
      },
      topTrackers: performanceOverview.trackerSummaries.slice(0, 5),
      topPerformers: performanceOverview.userSummaries.slice(0, 5),
      competitions: competitionSummaries,
      campaignBreakdown: campaignRows.map((campaign) => ({
        campaignId: campaign.id,
        campaignName: campaign.name,
        podCount: campaign._count.pods,
        trackerCount: campaign._count.trackerKpis,
      })),
      notificationBreakdown,
    };
  },
};
