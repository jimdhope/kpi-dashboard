import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { performanceService } from "@/server/services/performance-service";
import { authService } from "@/server/services/auth-service";
import { prisma } from "@/server/db/client";
import { startOfDay, endOfDay } from "date-fns";

const schema = z.object({
  trackerKpiId: z.string().min(1),
  value: z.number(),
  loggedAt: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  try {
    await authService.requireCurrentUser();
    const { searchParams } = new URL(request.url);
    const podId = searchParams.get("podId");
    const dateStr = searchParams.get("date");

    // Filtered query for the log matrix form
    if (podId && dateStr) {
      const date = new Date(dateStr);
      const memberships = await prisma.podMembership.findMany({
        where: { podId },
        select: { userId: true },
      });
      const userIds = memberships.map((m) => m.userId);
      const logs = await prisma.trackerLog.findMany({
        where: {
          userId: { in: userIds },
          loggedAt: { gte: startOfDay(date), lte: endOfDay(date) },
        },
        select: { userId: true, trackerKpiId: true, value: true },
      });
      return ok(logs.map((l) => ({ ...l, value: Number(l.value) })));
    }

    return ok(await performanceService.listLogs());
  } catch {
    return errorResponse(401, "Unauthorized");
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    return ok(await performanceService.createLog(payload), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid performance log payload.");
    }
    if (error instanceof Error) {
      return errorResponse(400, error.message);
    }
    return errorResponse(500, "Failed to create performance log.");
  }
}
