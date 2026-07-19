import { errorResponse, ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { prisma } from "@/server/db/client";

export async function GET() {
  try {
    const user = await authService.requireCurrentUser();
    const notifications = await prisma.notification.findMany({ where: { recipientId: user.id }, orderBy: { createdAt: "desc" }, take: 30 });
    return ok({ notifications, unreadCount: notifications.filter((item) => !item.readAt).length });
  } catch { return errorResponse(401, "Unauthorized"); }
}

export async function PATCH() {
  try {
    const user = await authService.requireCurrentUser();
    await prisma.notification.updateMany({ where: { recipientId: user.id, readAt: null }, data: { readAt: new Date() } });
    return ok({ success: true });
  } catch { return errorResponse(401, "Unauthorized"); }
}
