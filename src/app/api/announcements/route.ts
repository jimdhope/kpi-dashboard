import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { requireResourceAccess } from "@/server/services/authorization";
import { prisma } from "@/server/db/client";
import { notificationService } from "@/server/services/notification-service";

const announcementSchema = z.object({
  title: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(1_000),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const includeAll = new URL(request.url).searchParams.get("all") === "true";
    if (includeAll) {
      await requireResourceAccess("nav.settings.announcements", "MANAGE");
      const announcements = await prisma.messageOfDay.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
      return ok({ announcements });
    }
    await authService.requireCurrentUser();
    const now = new Date();
    const announcement = await prisma.messageOfDay.findFirst({
      where: { isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: { createdAt: "desc" },
    });
    return ok({ announcement });
  } catch {
    return errorResponse(401, "Unauthorized");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireResourceAccess("nav.settings.announcements", "MANAGE");
    const payload = announcementSchema.parse(await request.json());
    const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : null;
    if (expiresAt && expiresAt <= new Date()) return errorResponse(400, "Expiry must be in the future.");
    const announcement = await prisma.$transaction(async (tx) => {
      await tx.messageOfDay.updateMany({ where: { isActive: true }, data: { isActive: false } });
      return tx.messageOfDay.create({ data: { title: payload.title, message: payload.message, expiresAt, createdById: user.id } });
    });
    try {
      await notificationService.createForAllUsers({ type: "ANNOUNCEMENT", title: payload.title, message: payload.message, href: "/dashboard" });
    } catch (notificationError) {
      console.error("Announcement notification failed:", notificationError);
    }
    return ok({ announcement }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(400, "Invalid announcement.");
    if (error instanceof Error && error.message === "Forbidden") return errorResponse(403, "Forbidden");
    return errorResponse(500, "Failed to publish announcement.");
  }
}
