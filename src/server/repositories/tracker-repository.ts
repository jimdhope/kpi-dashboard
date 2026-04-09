import { prisma } from "@/server/db/client";
import { Prisma } from "@prisma/client";

export const trackerRepository = {
  async listKpis(campaignId?: string) {
    const kpis = await prisma.trackerKpi.findMany({
      where: campaignId ? { campaignId } : undefined,
      include: {
        campaign: { select: { name: true } },
        _count: {
          select: { logs: true },
        },
      },
    });

    return kpis.map(k => ({
      ...k,
      targetValue: k.targetValue ? k.targetValue.toNumber() : null,
      campaignName: k.campaign?.name || null,
      createdAt: k.createdAt.toISOString(),
      updatedAt: k.updatedAt.toISOString(),
    }));
  },
  
  async findById(id: string) {
    const kpi = await prisma.trackerKpi.findUnique({
      where: { id },
      include: {
        campaign: { select: { id: true, name: true, outgoingWebhookId: true } },
      },
    });

    if (!kpi) return null;
    return {
      ...kpi,
      targetValue: kpi.targetValue ? kpi.targetValue.toNumber() : null,
      campaignName: kpi.campaign?.name || null,
      createdAt: kpi.createdAt.toISOString(),
      updatedAt: kpi.updatedAt.toISOString(),
    };
  },

  async logValue(input: {
    trackerKpiId: string;
    userId: string;
    value: number;
    description?: string;
  }) {
    return prisma.trackerLog.create({
      data: {
        trackerKpiId: input.trackerKpiId,
        userId: input.userId,
        value: new Prisma.Decimal(input.value),
      },
    });
  },

  async getDailySum(trackerKpiId: string, day: Date) {
    const startOfDay = new Date(day);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(day);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await prisma.trackerLog.aggregate({
      where: {
        trackerKpiId,
        loggedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      _sum: {
        value: true,
      },
    });

    return result._sum.value?.toNumber() || 0;
  },

  async getPodDailySum(podId: string, day: Date) {
    const startOfDay = new Date(day);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(day);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await prisma.trackerLog.aggregate({
      where: {
        user: {
          podMemberships: {
            some: { podId },
          },
        },
        loggedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      _sum: {
        value: true,
      },
    });

    return result._sum.value?.toNumber() || 0;
  },

  async listUserLogs(userId: string, limit = 20) {
    return prisma.trackerLog.findMany({
      where: { userId },
      include: {
        trackerKpi: true,
      },
      orderBy: { loggedAt: "desc" },
      take: limit,
    });
  },
};
