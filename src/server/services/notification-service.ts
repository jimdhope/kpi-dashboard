import "server-only";
import { NotificationType } from "@prisma/client";
import { prisma } from "@/server/db/client";

export const notificationService = {
  async create(input: { recipientId: string; type: NotificationType; title: string; message: string; href?: string }) {
    const recipient = await prisma.user.findUnique({ where: { id: input.recipientId }, select: { id: true } });
    if (!recipient) return null;
    return prisma.notification.create({ data: input });
  },

  async createForAdmins(input: { type: NotificationType; title: string; message: string; href?: string }) {
    const admins = await prisma.user.findMany({ where: { userRoles: { some: { role: { key: "admin" } } } }, select: { id: true } });
    if (!admins.length) return [];
    return prisma.notification.createMany({ data: admins.map((admin) => ({ ...input, recipientId: admin.id })) });
  },

  async createForAllUsers(input: { type: NotificationType; title: string; message: string; href?: string }) {
    const users = await prisma.user.findMany({ select: { id: true } });
    if (!users.length) return [];
    return prisma.notification.createMany({ data: users.map((user) => ({ ...input, recipientId: user.id })) });
  },
};
