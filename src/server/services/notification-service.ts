import type { NotificationType, NotificationPriority } from "@prisma/client";
import { notificationRepository } from "@/server/repositories/notification-repository";

export const notificationService = {
  async create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    priority?: NotificationPriority;
    actionUrl?: string;
    metadata?: Record<string, unknown>;
  }) {
    return notificationRepository.create(data);
  },

  async list(userId: string, limit?: number, offset?: number) {
    return notificationRepository.list(userId, limit, offset);
  },

  async getUnreadCount(userId: string) {
    return notificationRepository.getUnreadCount(userId);
  },

  async markAsRead(id: string, userId: string) {
    return notificationRepository.markAsRead(id, userId);
  },

  async markAllAsRead(userId: string) {
    return notificationRepository.markAllAsRead(userId);
  },
};
