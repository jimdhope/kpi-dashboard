import { prisma } from "@/server/db/client";
import { ActivityRecord } from "@/lib/contracts";
import { Prisma, Activity } from "@prisma/client";

function mapActivity(activity: Activity & { user?: { name: string } | null }): ActivityRecord {
  return {
    id: activity.id,
    userId: activity.userId,
    userName: activity.user?.name ?? "System",
    type: activity.type,
    title: activity.title,
    description: activity.description,
    metadataJson: activity.metadataJson as Record<string, unknown> | null,
    createdAt: activity.createdAt.toISOString(),
    agentName: activity.agentName,
    recorderId: activity.recorderId,
    recorderName: activity.recorderName,
    richMessage: activity.richMessage,
  };
}

export const activityRepository = {
  async listRecent(limit = 20): Promise<ActivityRecord[]> {
    const activities = await prisma.activity.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: {
          select: { name: true },
        },
      },
    });

    return activities.map(mapActivity);
  },

  async create(input: {
    userId?: string | null;
    type: string;
    title: string;
    description?: string | null;
    metadata?: Record<string, unknown> | null;
    agentName?: string | null;
    recorderId?: string | null;
    recorderName?: string | null;
    richMessage?: string | null;
  }): Promise<ActivityRecord> {
    const activity = await prisma.activity.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        description: input.description,
        metadataJson: input.metadata as Prisma.InputJsonValue,
        agentName: input.agentName,
        recorderId: input.recorderId,
        recorderName: input.recorderName,
        richMessage: input.richMessage,
      },
      include: {
        user: {
          select: { name: true },
        },
      },
    });

    return mapActivity(activity);
  },

  async countDailyForUser(userId: string, type: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return prisma.activity.count({
      where: {
        userId,
        type,
        createdAt: {
          gte: today,
        },
      },
    });
  },

  async listPodDailyStats(podId: string, type: string): Promise<ActivityRecord[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activities = await prisma.activity.findMany({
      where: {
        type,
        createdAt: {
          gte: today,
        },
        user: {
          podMemberships: {
            some: {
              podId,
            },
          },
        },
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    return activities.map(mapActivity);
  },
};
