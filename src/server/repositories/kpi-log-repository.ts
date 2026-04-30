import { prisma } from "@/server/db/client";
import { Prisma } from "@prisma/client";

export interface KpiLogRecord {
  id: string;
  kpiId: string;
  kpiName: string;
  userId: string | null;
  userName: string | null;
  value: number;
  date: string;       // When the KPI was achieved
  loggedAt: string;   // When it was imported
  createdAt: string;
}

function toNumber(value: { toNumber(): number }): number {
  return value.toNumber();
}

export const kpiLogRepository = {
  async create(input: {
    kpiId: string;
    userId: string;
    value: number;
    date: Date;       // When the KPI was achieved
    loggedAt?: Date;  // When it was logged (defaults to now)
  }): Promise<KpiLogRecord> {
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
      userId: log.userId,
      userName: log.user?.name ?? null,
      value: toNumber(log.value),
      date: log.date.toISOString(),
      loggedAt: log.loggedAt.toISOString(),
      createdAt: log.createdAt.toISOString(),
    };
  },

  async list(filters?: {
    podId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<KpiLogRecord[]> {
    try {
      // Build where clause - filter by 'date' (when KPI was achieved)
      const where: Prisma.KpiLogWhereInput = {};

      if (filters?.startDate) {
        where.date = {
          ...(where.date as any || {}),
          gte: new Date(filters.startDate),
        };
      }
      if (filters?.endDate) {
        where.date = {
          ...(where.date as any || {}),
          lte: new Date(filters.endDate),
        };
      }

      // If podId is provided, filter by users in that pod
      if (filters?.podId) {
        const memberships = await prisma.podMembership.findMany({
          where: { podId: filters.podId },
          select: { userId: true },
        });
        const userIds = memberships.map((m) => m.userId);
        where.userId = { in: userIds };
      }

      const logs = await prisma.kpiLog.findMany({
        where,
        include: {
          kpi: {
            select: {
              id: true,
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
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      });

      return logs.map((log) => ({
        id: log.id,
        kpiId: log.kpiId,
        kpiName: log.kpi.name,
        userId: log.userId,
        userName: log.user?.name ?? null,
        value: toNumber(log.value),
        date: log.date.toISOString(),
        loggedAt: log.loggedAt.toISOString(),
        createdAt: log.createdAt.toISOString(),
      }));
    } catch (error) {
      console.error("kpiLogRepository.list error:", error);
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    await prisma.kpiLog.delete({
      where: { id },
    });
  },

  async deleteByUserAndKpiAndDate(
    userId: string,
    kpiId: string,
    date: Date
  ): Promise<void> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    await prisma.kpiLog.deleteMany({
      where: {
        userId,
        kpiId,
        date: {  // Use 'date' field (when KPI was achieved)
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });
  },
};
