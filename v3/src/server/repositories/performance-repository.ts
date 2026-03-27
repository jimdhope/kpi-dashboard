import { PerformanceLogRecord, PerformanceOverview, PerformanceTrackerSummary, PerformanceUserSummary, KpiRecord } from "@/lib/contracts";
import { prisma } from "@/server/db/client";

function toNumber(value: { toNumber(): number }): number {
  return value.toNumber();
}

function mapLog(record: {
  id: string;
  trackerKpiId: string;
  value: { toNumber(): number };
  loggedAt: Date;
  createdAt: Date;
  trackerKpi: { name: string };
  user: { id: string; name: string } | null;
}): PerformanceLogRecord {
  return {
    id: record.id,
    trackerKpiId: record.trackerKpiId,
    trackerName: record.trackerKpi.name,
    userId: record.user?.id ?? null,
    userName: record.user?.name ?? null,
    value: toNumber(record.value),
    loggedAt: record.loggedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
  };
}

export const performanceRepository = {
  async createLog(input: { trackerKpiId: string; userId: string; value: number; loggedAt?: Date }) {
    const log = await prisma.trackerLog.create({
      data: {
        trackerKpiId: input.trackerKpiId,
        userId: input.userId,
        value: input.value,
        loggedAt: input.loggedAt ?? new Date(),
      },
      include: {
        trackerKpi: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return mapLog(log);
  },

  async listLogs() {
    const logs = await prisma.trackerLog.findMany({
      include: {
        trackerKpi: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ loggedAt: "desc" }, { createdAt: "desc" }],
      take: 100,
    });

    return logs.map(mapLog);
  },

  async getOverview(): Promise<PerformanceOverview> {
    const [logs, trackerGroups, userGroups, trackers, users] = await Promise.all([
      performanceRepository.listLogs(),
      prisma.trackerLog.groupBy({
        by: ["trackerKpiId"],
        _sum: {
          value: true,
        },
        _count: {
          _all: true,
        },
      }),
      prisma.trackerLog.groupBy({
        by: ["userId"],
        where: {
          userId: {
            not: null,
          },
        },
        _sum: {
          value: true,
        },
        _count: {
          _all: true,
        },
      }),
      prisma.trackerKpi.findMany({
        select: {
          id: true,
          name: true,
          unit: true,
          targetValue: true,
        },
      }),
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
        },
      }),
    ]);

    const trackerMap = new Map(trackers.map((tracker) => [tracker.id, tracker]));
    const userMap = new Map(users.map((user) => [user.id, user]));

    const trackerSummaries: PerformanceTrackerSummary[] = trackerGroups.map((group) => {
      const tracker = trackerMap.get(group.trackerKpiId);
      return {
        trackerId: group.trackerKpiId,
        trackerName: tracker?.name ?? "Unknown tracker",
        unit: tracker?.unit ?? null,
        targetValue: tracker?.targetValue ? tracker.targetValue.toNumber() : null,
        totalValue: group._sum.value ? group._sum.value.toNumber() : 0,
        logCount: group._count._all,
      };
    });

    const userSummaries: PerformanceUserSummary[] = userGroups
      .map((group) => {
        const userId = group.userId;
        if (!userId) {
          return null;
        }

        const user = userMap.get(userId);
        return {
          userId,
          userName: user?.name ?? "Unknown user",
          totalValue: group._sum.value ? group._sum.value.toNumber() : 0,
          logCount: group._count._all,
        };
      })
      .filter((summary): summary is PerformanceUserSummary => Boolean(summary))
      .sort((a, b) => b.totalValue - a.totalValue);

    return {
      logs,
      trackerSummaries: trackerSummaries.sort((a, b) => b.totalValue - a.totalValue),
      userSummaries,
    };
  },

  // KPI Log functions
  async createKpiLog(input: { kpiId: string; userId: string; value: number; date: Date; loggedAt?: Date }) {
    const log = await prisma.kpiLog.create({
      data: {
        kpiId: input.kpiId,
        userId: input.userId,
        value: input.value,
        date: input.date,
        loggedAt: input.loggedAt ?? new Date(),
      },
      include: {
        kpi: {
          select: {
            id: true,
            name: true,
            initials: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      id: log.id,
      kpiId: log.kpiId,
      kpiName: log.kpi.name,
      kpiInitials: log.kpi.initials,
      userId: log.userId,
      userName: log.user?.name ?? null,
      value: toNumber(log.value),
      date: log.date.toISOString(),
      loggedAt: log.loggedAt.toISOString(),
      createdAt: log.createdAt.toISOString(),
    };
  },

  async listKpiLogs(filters?: { podId?: string; startDate?: string; endDate?: string }) {
    // Build where clause - filter by 'date' (when KPI was achieved)
    const where: any = {};
    
    if (filters?.startDate) {
      where.date = { ...where.date, gte: new Date(filters.startDate) };
    }
    if (filters?.endDate) {
      where.date = { ...where.date, lte: new Date(filters.endDate) };
    }
    
    // If podId is provided, filter by users in that pod
    if (filters?.podId) {
      const memberships = await prisma.podMembership.findMany({
        where: { podId: filters.podId },
        select: { userId: true },
      });
      const userIds = memberships.map(m => m.userId);
      where.userId = { in: userIds };
    }

    const logs = await prisma.kpiLog.findMany({
      where,
      include: {
        kpi: {
          select: {
            id: true,
            name: true,
            initials: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });

    return logs.map((log) => ({
      id: log.id,
      kpiId: log.kpiId,
      kpiName: log.kpi.name,
      kpiInitials: log.kpi.initials,
      userId: log.userId,
      userName: log.user?.name ?? null,
      value: toNumber(log.value),
      date: log.date.toISOString(),
      loggedAt: log.loggedAt.toISOString(),
      createdAt: log.createdAt.toISOString(),
    }));
  },
};
