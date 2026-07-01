import { NextRequest } from "next/server";
import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { prisma } from "@/server/db/client";

export async function GET(request: NextRequest) {
  try {
    await authService.requireAdmin();
    const { searchParams } = new URL(request.url);
    const competitionId = searchParams.get("competitionId");
    if (!competitionId) {
      return errorResponse(400, "Missing competitionId query parameter");
    }

    const agentBadges = await prisma.agentBadge.findMany({
      where: { competitionId },
      include: {
        badge: { select: { key: true, name: true } },
        agentProfile: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { earnedAt: "desc" },
    });

    const grouped: Record<string, {
      badgeKey: string;
      badgeName: string;
      agents: Array<{ name: string; earnedAt: string; agentProfileId: string; rank: number | null }>;
    }> = {};

    for (const ab of agentBadges) {
      const key = ab.badge.key;
      if (!grouped[key]) {
        grouped[key] = { badgeKey: key, badgeName: ab.badge.name, agents: [] };
      }
      grouped[key].agents.push({
        name: ab.agentProfile.user.name ?? ab.agentProfile.user.email ?? "Unknown",
        earnedAt: ab.earnedAt.toISOString(),
        agentProfileId: ab.agentProfileId,
        rank: (ab.context as any)?.rank ?? null,
      });
    }

    const entries = Object.values(grouped).sort((a, b) => a.badgeKey.localeCompare(b.badgeKey));

    return ok({ entries, competitionId });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse(401, "Unauthorized");
    }
    return errorResponse(500, "Failed to fetch earned badges.");
  }
}
