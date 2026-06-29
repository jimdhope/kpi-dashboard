import { prisma } from "@/server/db/client";
import type { NotificationType, NotificationPriority, Prisma } from "@prisma/client";

export const notificationRepository = {
  async create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    priority?: NotificationPriority;
    actionUrl?: string;
    metadataJson?: Record<string, unknown>;
  }) {
    return prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        priority: data.priority ?? "medium",
        actionUrl: data.actionUrl ?? null,
        metadataJson: data.metadataJson as Prisma.InputJsonValue ?? undefined,
      },
    });
  },

  async list(userId: string, limit = 20, offset = 0) {
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({ where: { userId } }),
    ]);
    return { notifications, total };
  },

  async getUnreadCount(userId: string) {
    return prisma.notification.count({
      where: { userId, readAt: null },
    });
  },

  async markAsRead(id: string, userId: string) {
    await prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  },

  async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  },
};
