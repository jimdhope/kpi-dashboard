import { Prisma, RoleKey } from "@prisma/client";
import { prisma } from "@/server/db/client";

export interface BackupData {
  version: string;
  exportedAt: string;
  data: {
    roles: unknown[];
    users: unknown[];
    campaigns: unknown[];
    pods: unknown[];
    podMemberships: unknown[];
    trackerKpis: unknown[];
    trackerLogs: unknown[];
    competitions: unknown[];
    competitionRules: unknown[];
    competitionTeams: unknown[];
    competitionEntries: unknown[];
    competitionScoreLogs: unknown[];
    competitionRuleTemplates: unknown[];
    dailyAchievements: unknown[];
    dailyTaskLogs: unknown[];
    teamBonusLogs: unknown[];
    podTargets: unknown[];
    activities: unknown[];
    notifications: unknown[];
    userNotificationSettings: unknown[];
    appPushSettings: unknown[];
    teamsWebhookEndpoints: unknown[];
    teamsAutomations: unknown[];
    teamsMessageTemplates: unknown[];
    teamsIncomingEvents: unknown[];
    rpsGames: unknown[];
    importLogs: unknown[];
    tags: unknown[];
    kbCategories: unknown[];
    kbArticles: unknown[];
    kbVersions: unknown[];
    kbComments: unknown[];
    companies: unknown[];
    departments: unknown[];
    contacts: unknown[];
    kpis: unknown[];
    kpiLogs: unknown[];
  };
}

export const backupService = {
  async exportAllData(): Promise<BackupData> {
    const [
      roles,
      users,
      campaigns,
      pods,
      podMemberships,
      trackerKpis,
      trackerLogs,
      competitions,
      competitionRules,
      competitionTeams,
      competitionEntries,
      competitionScoreLogs,
      competitionRuleTemplates,
      dailyAchievements,
      dailyTaskLogs,
      teamBonusLogs,
      podTargets,
      activities,
      notifications,
      userNotificationSettings,
      appPushSettings,
      teamsWebhookEndpoints,
      teamsAutomations,
      teamsMessageTemplates,
      teamsIncomingEvents,
      rpsGames,
      importLogs,
      tags,
      kbCategories,
      kbArticles,
      kbVersions,
      kbComments,
      companies,
      departments,
      contacts,
      kpis,
      kpiLogs,
    ] = await Promise.all([
      prisma.role.findMany(),
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          passwordHash: true,
          avatarUrl: true,
          avatarInitials: true,
          avatarBgColor: true,
          firebaseUid: true,
          mustChangePassword: true,
          podId: true,
          createdAt: true,
          updatedAt: true,
          userRoles: true,
        },
      }),
      prisma.campaign.findMany(),
      prisma.pod.findMany(),
      prisma.podMembership.findMany(),
      prisma.trackerKpi.findMany(),
      prisma.trackerLog.findMany(),
      prisma.competition.findMany(),
      prisma.competitionRule.findMany(),
      prisma.competitionTeam.findMany(),
      prisma.competitionEntry.findMany(),
      prisma.competitionScoreLog.findMany(),
      prisma.competitionRuleTemplate.findMany(),
      prisma.dailyAchievement.findMany(),
      prisma.dailyTaskLog.findMany(),
      prisma.teamBonusLog.findMany(),
      prisma.podTarget.findMany(),
      prisma.activity.findMany(),
      prisma.notification.findMany(),
      prisma.userNotificationSettings.findMany(),
      prisma.appPushSettings.findMany(),
      prisma.teamsWebhookEndpoint.findMany(),
      prisma.teamsAutomation.findMany(),
      prisma.teamsMessageTemplate.findMany(),
      prisma.teamsIncomingEvent.findMany(),
      prisma.rpsGame.findMany(),
      prisma.importLog.findMany(),
      prisma.tag.findMany(),
      prisma.kBCategory.findMany(),
      prisma.kBArticle.findMany(),
      prisma.kBVersion.findMany(),
      prisma.kBComment.findMany(),
      prisma.company.findMany(),
      prisma.department.findMany(),
      prisma.contact.findMany(),
      prisma.kpi.findMany(),
      prisma.kpiLog.findMany(),
    ]);

    return {
      version: "3.5",
      exportedAt: new Date().toISOString(),
      data: {
        roles,
        users,
        campaigns,
        pods,
        podMemberships,
        trackerKpis,
        trackerLogs,
        competitions,
        competitionRules,
        competitionTeams,
        competitionEntries,
        competitionScoreLogs,
        competitionRuleTemplates,
        dailyAchievements,
        dailyTaskLogs,
        teamBonusLogs,
        podTargets,
        activities,
        notifications,
        userNotificationSettings,
        appPushSettings,
        teamsWebhookEndpoints,
        teamsAutomations,
        teamsMessageTemplates,
        teamsIncomingEvents,
        rpsGames,
        importLogs,
        tags,
        kbCategories,
        kbArticles,
        kbVersions,
        kbComments,
        companies,
        departments,
        contacts,
        kpis,
        kpiLogs,
      },
    };
  },

  async importData(backupData: BackupData, options?: { clearExisting?: boolean }) {
    const clearExisting = options?.clearExisting ?? false;
    const { data } = backupData;

    if (clearExisting) {
      await this.clearAllData();
    }

    const results: { table: string; imported: number; errors: string[] }[] = [];

    try {
      if (data.roles?.length > 0) {
        for (const role of data.roles as Array<{ key: string; name: string }>) {
          await prisma.role.upsert({
            where: { key: role.key as RoleKey },
            update: { name: role.name },
            create: { key: role.key as RoleKey, name: role.name },
          });
        }
        results.push({ table: "roles", imported: data.roles.length, errors: [] });
      }
    } catch (e) {
      results.push({ table: "roles", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.users?.length > 0) {
        const userIds: string[] = [];
        for (const user of data.users as Array<{
          id: string;
          email: string;
          name: string;
          passwordHash: string;
          userRoles: string[];
        }>) {
          const created = await prisma.user.upsert({
            where: { email: user.email },
            update: {
              name: user.name,
              passwordHash: user.passwordHash,
              avatarUrl: (user as any).avatarUrl,
              avatarInitials: (user as any).avatarInitials,
              avatarBgColor: (user as any).avatarBgColor,
            },
            create: {
              id: user.id,
              email: user.email,
              name: user.name,
              passwordHash: user.passwordHash,
              userRoles: user.userRoles as any,
            },
          });
          userIds.push(created.id);
        }
        results.push({ table: "users", imported: userIds.length, errors: [] });
      }
    } catch (e) {
      results.push({ table: "users", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.campaigns?.length > 0) {
        const campaignIds: string[] = [];
        for (const campaign of data.campaigns as Array<{ id: string; name: string }>) {
          const created = await prisma.campaign.upsert({
            where: { id: campaign.id },
            update: { name: campaign.name },
            create: { id: campaign.id, name: campaign.name },
          });
          campaignIds.push(created.id);
        }
        results.push({ table: "campaigns", imported: campaignIds.length, errors: [] });
      }
    } catch (e) {
      results.push({ table: "campaigns", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.pods?.length > 0) {
        const podIds: string[] = [];
        for (const pod of data.pods as Array<{ id: string; name: string; campaignId?: string | null }>) {
          const created = await prisma.pod.upsert({
            where: { id: pod.id },
            update: { name: pod.name },
            create: { id: pod.id, name: pod.name, campaignId: pod.campaignId },
          });
          podIds.push(created.id);
        }
        results.push({ table: "pods", imported: podIds.length, errors: [] });
      }
    } catch (e) {
      results.push({ table: "pods", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.podMemberships?.length > 0) {
        const count = await prisma.podMembership.createMany({
          data: data.podMemberships as any[],
          skipDuplicates: true,
        });
        results.push({ table: "podMemberships", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "podMemberships", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.trackerKpis?.length > 0) {
        const count = await prisma.trackerKpi.createMany({
          data: data.trackerKpis as any[],
          skipDuplicates: true,
        });
        results.push({ table: "trackerKpis", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "trackerKpis", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.trackerLogs?.length > 0) {
        const count = await prisma.trackerLog.createMany({
          data: data.trackerLogs as any[],
          skipDuplicates: true,
        });
        results.push({ table: "trackerLogs", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "trackerLogs", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.competitions?.length > 0) {
        const count = await prisma.competition.createMany({
          data: data.competitions as any[],
          skipDuplicates: true,
        });
        results.push({ table: "competitions", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "competitions", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.competitionRules?.length > 0) {
        const count = await prisma.competitionRule.createMany({
          data: data.competitionRules as any[],
          skipDuplicates: true,
        });
        results.push({ table: "competitionRules", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "competitionRules", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.competitionTeams?.length > 0) {
        const count = await prisma.competitionTeam.createMany({
          data: data.competitionTeams as any[],
          skipDuplicates: true,
        });
        results.push({ table: "competitionTeams", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "competitionTeams", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.competitionEntries?.length > 0) {
        const count = await prisma.competitionEntry.createMany({
          data: data.competitionEntries as any[],
          skipDuplicates: true,
        });
        results.push({ table: "competitionEntries", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "competitionEntries", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.competitionScoreLogs?.length > 0) {
        const count = await prisma.competitionScoreLog.createMany({
          data: data.competitionScoreLogs as any[],
          skipDuplicates: true,
        });
        results.push({ table: "competitionScoreLogs", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "competitionScoreLogs", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.competitionRuleTemplates?.length > 0) {
        const count = await prisma.competitionRuleTemplate.createMany({
          data: data.competitionRuleTemplates as any[],
          skipDuplicates: true,
        });
        results.push({ table: "competitionRuleTemplates", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "competitionRuleTemplates", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.dailyAchievements?.length > 0) {
        const count = await prisma.dailyAchievement.createMany({
          data: data.dailyAchievements as any[],
          skipDuplicates: true,
        });
        results.push({ table: "dailyAchievements", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "dailyAchievements", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.dailyTaskLogs?.length > 0) {
        const count = await prisma.dailyTaskLog.createMany({
          data: data.dailyTaskLogs as any[],
          skipDuplicates: true,
        });
        results.push({ table: "dailyTaskLogs", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "dailyTaskLogs", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.teamBonusLogs?.length > 0) {
        const count = await prisma.teamBonusLog.createMany({
          data: data.teamBonusLogs as any[],
          skipDuplicates: true,
        });
        results.push({ table: "teamBonusLogs", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "teamBonusLogs", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.podTargets?.length > 0) {
        const count = await prisma.podTarget.createMany({
          data: data.podTargets as any[],
          skipDuplicates: true,
        });
        results.push({ table: "podTargets", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "podTargets", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.activities?.length > 0) {
        const count = await prisma.activity.createMany({
          data: data.activities as any[],
          skipDuplicates: true,
        });
        results.push({ table: "activities", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "activities", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.notifications?.length > 0) {
        const count = await prisma.notification.createMany({
          data: data.notifications as any[],
          skipDuplicates: true,
        });
        results.push({ table: "notifications", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "notifications", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.userNotificationSettings?.length > 0) {
        const count = await prisma.userNotificationSettings.createMany({
          data: data.userNotificationSettings as any[],
          skipDuplicates: true,
        });
        results.push({ table: "userNotificationSettings", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "userNotificationSettings", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.teamsWebhookEndpoints?.length > 0) {
        const count = await prisma.teamsWebhookEndpoint.createMany({
          data: data.teamsWebhookEndpoints as any[],
          skipDuplicates: true,
        });
        results.push({ table: "teamsWebhookEndpoints", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "teamsWebhookEndpoints", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.teamsAutomations?.length > 0) {
        const count = await prisma.teamsAutomation.createMany({
          data: data.teamsAutomations as any[],
          skipDuplicates: true,
        });
        results.push({ table: "teamsAutomations", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "teamsAutomations", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.teamsMessageTemplates?.length > 0) {
        const count = await prisma.teamsMessageTemplate.createMany({
          data: data.teamsMessageTemplates as any[],
          skipDuplicates: true,
        });
        results.push({ table: "teamsMessageTemplates", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "teamsMessageTemplates", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.rpsGames?.length > 0) {
        const count = await prisma.rpsGame.createMany({
          data: data.rpsGames as any[],
          skipDuplicates: true,
        });
        results.push({ table: "rpsGames", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "rpsGames", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.tags?.length > 0) {
        const count = await prisma.tag.createMany({
          data: data.tags as any[],
          skipDuplicates: true,
        });
        results.push({ table: "tags", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "tags", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.kbCategories?.length > 0) {
        const count = await prisma.kBCategory.createMany({
          data: data.kbCategories as any[],
          skipDuplicates: true,
        });
        results.push({ table: "kbCategories", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "kbCategories", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.kbArticles?.length > 0) {
        const count = await prisma.kBArticle.createMany({
          data: data.kbArticles as any[],
          skipDuplicates: true,
        });
        results.push({ table: "kbArticles", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "kbArticles", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.kbVersions?.length > 0) {
        const count = await prisma.kBVersion.createMany({
          data: data.kbVersions as any[],
          skipDuplicates: true,
        });
        results.push({ table: "kbVersions", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "kbVersions", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.kbComments?.length > 0) {
        const count = await prisma.kBComment.createMany({
          data: data.kbComments as any[],
          skipDuplicates: true,
        });
        results.push({ table: "kbComments", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "kbComments", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.companies?.length > 0) {
        const count = await prisma.company.createMany({
          data: data.companies as any[],
          skipDuplicates: true,
        });
        results.push({ table: "companies", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "companies", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.departments?.length > 0) {
        const count = await prisma.department.createMany({
          data: data.departments as any[],
          skipDuplicates: true,
        });
        results.push({ table: "departments", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "departments", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.contacts?.length > 0) {
        const count = await prisma.contact.createMany({
          data: data.contacts as any[],
          skipDuplicates: true,
        });
        results.push({ table: "contacts", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "contacts", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.kpis?.length > 0) {
        const count = await prisma.kpi.createMany({
          data: data.kpis as any[],
          skipDuplicates: true,
        });
        results.push({ table: "kpis", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "kpis", imported: 0, errors: [(e as Error).message] });
    }

    try {
      if (data.kpiLogs?.length > 0) {
        const count = await prisma.kpiLog.createMany({
          data: data.kpiLogs as any[],
          skipDuplicates: true,
        });
        results.push({ table: "kpiLogs", imported: count.count, errors: [] });
      }
    } catch (e) {
      results.push({ table: "kpiLogs", imported: 0, errors: [(e as Error).message] });
    }

    return results;
  },

  async clearAllData() {
    await prisma.kBComment.deleteMany();
    await prisma.kBVersion.deleteMany();
    await prisma.kBArticle.deleteMany();
    await prisma.kBCategory.deleteMany();
    await prisma.contact.deleteMany();
    await prisma.department.deleteMany();
    await prisma.company.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.rpsGame.deleteMany();
    await prisma.teamsIncomingEvent.deleteMany();
    await prisma.teamsAutomationPendingDelivery.deleteMany();
    await prisma.teamsAutomation.deleteMany();
    await prisma.teamsMessageTemplate.deleteMany();
    await prisma.teamsWebhookEndpoint.deleteMany();
    await prisma.appPushSettings.deleteMany();
    await prisma.userNotificationSettings.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.activity.deleteMany();
    await prisma.podTarget.deleteMany();
    await prisma.teamBonusLog.deleteMany();
    await prisma.dailyTaskLog.deleteMany();
    await prisma.dailyAchievement.deleteMany();
    await prisma.competitionScoreLog.deleteMany();
    await prisma.competitionEntry.deleteMany();
    await prisma.competitionTeam.deleteMany();
    await prisma.competitionRule.deleteMany();
    await prisma.competition.deleteMany();
    await prisma.competitionRuleTemplate.deleteMany();
    await prisma.trackerLog.deleteMany();
    await prisma.trackerKpi.deleteMany();
    await prisma.podMembership.deleteMany();
    await prisma.pod.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.kpiLog.deleteMany();
    await prisma.kpi.deleteMany();
    await prisma.user.deleteMany();
    await prisma.importLog.deleteMany();
  },
};