import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { performanceService } from "@/server/services/performance-service";
import { authService } from "@/server/services/auth-service";
import { prisma } from "@/server/db/client";

// UTC-based start/end of day (data stored in UTC)
function startOfDayUTC(dateStr: string): Date {
  const date = new Date(dateStr);
  // Create date at midnight UTC (12:00:00.000 UTC = start of that day in UTC)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function endOfDayUTC(dateStr: string): Date {
  const date = new Date(dateStr);
  // Create date at 23:59:59.999 UTC (end of that day in UTC)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

const schema = z.object({
  trackerKpiId: z.string().min(1),
  userId: z.string().min(1),
  value: z.number(),
  loggedAt: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  try {
    await authService.requireCurrentUser();
    const { searchParams } = new URL(request.url);
    const podId = searchParams.get("podId");
    const dateStr = searchParams.get("date");
    const podIdsParam = searchParams.get("podIds"); // Comma-separated pod IDs

    // Filtered query for dashboard - by multiple pod IDs
    if (podIdsParam) {
      const podIds = podIdsParam.split(',').filter(Boolean);
      const logs = await performanceService.listLogsByPodIds(podIds);
      return ok(logs);
    }

    // Filtered query for the log matrix form (single pod + date)
    if (podId && dateStr) {
      const memberships = await prisma.podMembership.findMany({
        where: { podId },
        select: { userId: true },
      });
      const userIds = memberships.map((m) => m.userId);
      const startUTC = startOfDayUTC(dateStr);
      const endUTC = endOfDayUTC(dateStr);
      const logs = await prisma.trackerLog.findMany({
        where: {
          userId: { in: userIds },
          loggedAt: { gte: startUTC, lte: endUTC },
        },
        select: { id: true, userId: true, trackerKpiId: true, value: true },
      });
      return ok({ logs: logs.map((l) => ({ ...l, value: Number(l.value) })) });
    }

    return ok(await performanceService.listLogs());
  } catch {
    return errorResponse(401, "Unauthorized");
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    return ok(await performanceService.createLog({
      trackerKpiId: payload.trackerKpiId,
      userId: payload.userId,
      value: payload.value,
      loggedAt: payload.loggedAt,
    }), { status: 201 });
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

export async function DELETE(request: Request) {
  try {
    await authService.requireCurrentUser();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return errorResponse(400, "Log ID is required");
    }

    await performanceService.deleteLog(id);
    return ok({ success: true, id });
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(400, error.message);
    }
    return errorResponse(500, "Failed to delete performance log.");
  }
}
