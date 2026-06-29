import { authService } from "@/server/services/auth-service";
import { errorResponse, ok } from "@/server/http";
import { prisma } from "@/server/db/client";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from "date-fns";

export async function GET(request: Request) {
  try {
    await authService.requireCurrentUser();
    const { searchParams } = new URL(request.url);
    const podId = searchParams.get("podId");
    const timeframe = searchParams.get("timeframe") ?? "thisWeek";

    const now = new Date();
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    switch (timeframe) {
      case "thisWeek":
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        endDate = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case "thisMonth":
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case "last6weeks":
        // No single date range — handled per-tracker below
        break;
      case "allTime":
      default:
        // No date filter
        break;
    }

    // Fetch all trackers (with sortOrder & type info)
    const trackers = await prisma.trackerKpi.findMany({
      select: { id: true, name: true, unit: true, targetValue: true },
      orderBy: { name: "asc" },
    });

    // Build user lookup. If a podId is specified, filter to users in that pod.
    const userWhere: any = podId && podId !== "all"
      ? { podMemberships: { some: { podId: podId } } }
      : {};
    const users = await prisma.user.findMany({
      where: userWhere,
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    const userIds = users.map((u) => u.id);

    // Fetch logs scoped to the timeframe + optional pod
    const logWhere: Record<string, unknown> = {
      userId: { in: userIds },
    };
    if (startDate) logWhere.loggedAt = { gte: startDate, lte: endDate };

    const logs = await prisma.trackerLog.findMany({
      where: logWhere,
      select: { trackerKpiId: true, userId: true, value: true, loggedAt: true },
    });

    // Build leaderboards per tracker
    const leaderboards = trackers.map((tracker) => {
      let trackerLogs = logs.filter((l) => l.trackerKpiId === tracker.id);

      if (timeframe === "last6weeks") {
        const maxDate = trackerLogs.reduce<Date | null>((latest, l) => {
          return !latest || l.loggedAt > latest ? l.loggedAt : latest;
        }, null);
        if (maxDate) {
          const windowStart = subDays(maxDate, 42);
          trackerLogs = trackerLogs.filter((l) => l.loggedAt >= windowStart && l.loggedAt <= maxDate);
        }
      }

      // Sum values per agent
      const agentTotals: Record<string, number> = {};
      for (const log of trackerLogs) {
        if (!log.userId) continue;
        agentTotals[log.userId] = (agentTotals[log.userId] ?? 0) + Number(log.value);
      }

      const entries = Object.entries(agentTotals)
        .map(([userId, score]) => ({
          agentId: userId,
          agentName: userMap.get(userId)?.name ?? "Unknown",
          score: timeframe === "last6weeks" ? score / 6 : score,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((entry, i) => ({ ...entry, rank: i + 1 }));

      return {
        tracker: {
          id: tracker.id,
          name: tracker.name,
          unit: tracker.unit,
          // Default to desc (higher is better) — can be extended if sortOrder is added to schema
          sortOrder: "desc" as const,
        },
        entries,
      };
    });

    return ok(leaderboards);
  } catch {
    return errorResponse(401, "Unauthorized");
  }
}
