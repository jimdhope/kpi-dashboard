import { authService } from "@/server/services/auth-service";
import { errorResponse, ok } from "@/server/http";
import { prisma } from "@/server/db/client";
import { z } from "zod";
import { startOfDay, endOfDay } from "date-fns";
import { permissionService } from "@/server/services/permission-service";

const batchSchema = z.object({
  logs: z.array(z.object({
    userId: z.string(),
    trackerKpiId: z.string(),
    value: z.number(),
    loggedAt: z.string(),
  })),
});

export async function POST(request: Request) {
  try {
    const currentUser = await authService.requireCurrentUser();
    const canManage = await permissionService.hasNavAccess(currentUser.roles, "performance", "MANAGE");
    if (!canManage) return errorResponse(403, "Forbidden");
    const { logs } = batchSchema.parse(await request.json());

    // For each log entry, find an existing log for the same user/tracker/day and update or create
    await Promise.all(
      logs.map(async (log) => {
        const loggedAt = startOfDay(new Date(log.loggedAt));
        const existing = await prisma.trackerLog.findFirst({
          where: {
            userId: log.userId,
            trackerKpiId: log.trackerKpiId,
            loggedAt: { gte: loggedAt, lte: endOfDay(new Date(log.loggedAt)) },
          },
          select: { id: true },
        });
        if (existing) {
          await prisma.trackerLog.update({
            where: { id: existing.id },
            data: { value: log.value },
          });
        } else {
          await prisma.trackerLog.create({
            data: {
              userId: log.userId,
              trackerKpiId: log.trackerKpiId,
              value: log.value,
              loggedAt,
            },
          });
        }
      })
    );

    return ok({ saved: logs.length });
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(400, "Invalid batch log payload.");
    return errorResponse(500, "Failed to save logs.");
  }
}
