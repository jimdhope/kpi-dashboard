import { notificationRepository } from "@/server/repositories/notification-repository";
import { authService } from "@/server/services/auth-service";

export const notificationService = {
  async listCurrentUserNotifications() {
    const currentUser = await authService.requireCurrentUser();
    return notificationRepository.listForUser(currentUser.id);
  },

  async createNotification(input: {
    userId: string;
    type: "competition_reminder" | "score_achievement" | "team_update" | "system_alert";
    title: string;
    message: string;
    priority: "low" | "medium" | "high";
    actionUrl?: string | null;
    metadata?: Record<string, unknown> | null;
  }) {
    const currentUser = await authService.requireCurrentUser();
    if (currentUser.id !== input.userId && !currentUser.roles.includes("admin")) {
      throw new Error("Forbidden");
    }

    return notificationRepository.create(input);
  },

  async createSystemNotificationForUser(input: {
    userId: string;
    type: "competition_reminder" | "score_achievement" | "team_update" | "system_alert";
    title: string;
    message: string;
    priority: "low" | "medium" | "high";
    actionUrl?: string | null;
    metadata?: Record<string, unknown> | null;
  }) {
    return notificationRepository.create(input);
  },

  async markRead(notificationId: string) {
    const currentUser = await authService.requireCurrentUser();
    await notificationRepository.markRead(notificationId, currentUser.id);
  },

  async markAllRead() {
    const currentUser = await authService.requireCurrentUser();
    await notificationRepository.markAllRead(currentUser.id);
  },

  async delete(notificationId: string) {
    const currentUser = await authService.requireCurrentUser();
    await notificationRepository.delete(notificationId, currentUser.id);
  },
};
