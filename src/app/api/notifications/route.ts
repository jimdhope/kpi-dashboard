import { errorResponse, ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { prisma } from "@/server/db/client";
import { z } from "zod";

const markReadSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(30).optional() }).optional();

export async function GET() {
  try {
    const user = await authService.requireCurrentUser();
    const notifications = await prisma.notification.findMany({ where: { recipientId: user.id, readAt: null }, orderBy: { createdAt: "desc" }, take: 30 });
    return ok({ notifications, unreadCount: notifications.length });
  } catch { return errorResponse(401, "Unauthorized"); }
}

export async function PATCH(request: Request) {
  try {
    const user = await authService.requireCurrentUser();
    const raw = await request.text();
    const payload = markReadSchema.parse(raw ? JSON.parse(raw) : undefined);
    await prisma.notification.updateMany({
      where: { recipientId: user.id, readAt: null, ...(payload?.ids ? { id: { in: payload.ids } } : {}) },
      data: { readAt: new Date() },
    });
    return ok({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return errorResponse(400, "Invalid notification selection.");
    return errorResponse(401, "Unauthorized");
  }
}
