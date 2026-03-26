import { Prisma } from "@prisma/client";
import { AppNotification } from "@/lib/contracts";
import { prisma } from "@/server/db/client";

function mapNotification(notification: {
  id: string;
  type: AppNotification["type"];
  title: string;
  message: string;
  priority: AppNotification["priority"];
  actionUrl: string | null;
  metadataJson: unknown;
  readAt: Date | null;
  createdAt: Date;
}): AppNotification {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    priority: notification.priority,
    actionUrl: notification.actionUrl,
    metadata:
      notification.metadataJson && typeof notification.metadataJson === "object"
        ? (notification.metadataJson as Record<string, unknown>)
        : null,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

export const notificationRepository = {
  async listForUser(userId: string) {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: {
        createdAt: "desc",
      },
    });

    return notifications.map(mapNotification);
  },

  async create(input: {
    userId: string;
    type: AppNotification["type"];
    title: string;
    message: string;
    priority: AppNotification["priority"];
    actionUrl?: string | null;
    metadata?: Record<string, unknown> | null;
  }) {
    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        priority: input.priority,
        actionUrl: input.actionUrl,
        metadataJson: (input.metadata as Prisma.InputJsonValue | null | undefined) ?? undefined,
      },
    });

    return mapNotification(notification);
  },

  async markRead(id: string, userId: string) {
    const notification = await prisma.notification.updateMany({
      where: {
        id,
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return notification.count > 0;
  },

  async markAllRead(userId: string) {
    await prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
  },

  async delete(id: string, userId: string) {
    await prisma.notification.deleteMany({
      where: {
        id,
        userId,
      },
    });
  },
};
