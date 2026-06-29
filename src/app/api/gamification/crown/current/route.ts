import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { prisma } from "@/server/db/client";

export async function GET() {
  try {
    await authService.requireCurrentUser();
    const badge = await prisma.badge.findUnique({ where: { key: "monthly_champion" } });
    if (!badge) return ok({ champion: null });

    const latest = await prisma.agentBadge.findFirst({
      where: { badgeId: badge.id },
      orderBy: { earnedAt: "desc" },
      include: { agentProfile: { include: { user: true } } },
    });
    if (!latest) return ok({ champion: null });

    const ctx = (latest.context as { month?: number; year?: number }) ?? {};
    const monthDate = ctx.year && ctx.month ? new Date(ctx.year, ctx.month - 1) : latest.earnedAt;
    return ok({ champion: { name: latest.agentProfile.user.name, monthDate } });
  } catch {
    return errorResponse(500, "Failed to fetch current champion.");
  }
}
