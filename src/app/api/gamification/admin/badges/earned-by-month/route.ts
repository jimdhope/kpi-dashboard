import { NextRequest } from "next/server";
import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { prisma } from "@/server/db/client";

export async function GET(request: NextRequest) {
  try {
    await authService.requireAdmin();
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
    const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const agentBadges = await prisma.agentBadge.findMany({
      where: {
        earnedAt: { gte: start, lte: end },
      },
      include: {
        badge: { select: { key: true, name: true } },
        user: { select: { name: true, email: true } },
      },
      orderBy: { earnedAt: "desc" },
    });

    const grouped: Record<string, {
      badgeKey: string;
      badgeName: string;
      agents: Array<{ name: string; earnedAt: string; userId: string; rank: number | null }>;
    }> = {};

    for (const ab of agentBadges) {
      const key = ab.badge.key;
      if (!grouped[key]) {
        grouped[key] = { badgeKey: key, badgeName: ab.badge.name, agents: [] };
      }
      grouped[key].agents.push({
        name: ab.user.name ?? ab.user.email ?? "Unknown",
        earnedAt: ab.earnedAt.toISOString(),
        userId: ab.userId,
        rank: (ab.context as any)?.rank ?? null,
      });
    }

    const entries = Object.values(grouped).sort((a, b) => a.badgeKey.localeCompare(b.badgeKey));

    return ok({ entries, month, year });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse(401, "Unauthorized");
    }
    return errorResponse(500, "Failed to fetch earned badges.");
  }
}
