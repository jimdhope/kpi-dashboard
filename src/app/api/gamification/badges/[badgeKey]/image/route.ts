import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/server/http";
import { prisma } from "@/server/db/client";
import { authService } from "@/server/services/auth-service";
import { badgeImageService } from "@/server/services/badge-image-service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ badgeKey: string }> }) {
  try {
    const user = await authService.requireCurrentUser();
    const { badgeKey } = await params;
    const { searchParams } = new URL(request.url);
    const overrideRank = searchParams.get("rank");
    const overrideStreak = searchParams.get("streak");

    const variables: Record<string, string> = {};
    const streakKeys = new Set(["streak_3", "streak_5", "streak_10"]);

    const agentBadge = await prisma.agentBadge.findFirst({
      where: {
        agentProfile: { userId: user.id },
        badge: { key: badgeKey },
      },
      orderBy: { earnedAt: "desc" },
    });

    const ctx = agentBadge?.context && typeof agentBadge.context === "object"
      ? (agentBadge.context as Record<string, unknown>)
      : {};

    const competitionId = ctx.competitionId as string | undefined;
    if (competitionId) {
      const competition = await prisma.competition.findUnique({
        where: { id: competitionId },
        select: { name: true },
      });
      if (competition) {
        variables.COMPETITION_NAME = competition.name;
      }
    }

    if (streakKeys.has(badgeKey)) {
      variables.STREAK = overrideStreak ?? "3";
    }

    if (badgeKey === "podium" || badgeKey === "monthly_top3") {
      let rank = 1;
      if (overrideRank) {
        rank = parseInt(overrideRank, 10);
      } else {
        rank = (ctx.rank as number) ?? 1;
      }

      const POSITION = rank === 1 ? "1st" : rank === 2 ? "2nd" : "3rd";
      const SHIELD_FILL = rank === 1 ? "#9f8f5eff" : rank === 2 ? "#969696ff" : "#996b4fff";
      const SHIELD_STROKE = rank === 1 ? "#7a6c40ff" : rank === 2 ? "#6a6a6aff" : "#7a4a33ff";
      variables.POSITION = POSITION;
      variables.SHIELD_FILL = SHIELD_FILL;
      variables.SHIELD_STROKE = SHIELD_STROKE;
    }

    if (badgeKey === "monthly_champion" || badgeKey === "monthly_top3") {
      const monthNum = (ctx.month as number) ?? new Date().getMonth() + 1;
      const yearNum = (ctx.year as number) ?? new Date().getFullYear();
      variables.MONTH = new Date(yearNum, monthNum - 1).toLocaleString("default", { month: "long" });
      variables.YEAR = String(yearNum);
    }

    if (agentBadge?.earnedAt) {
      variables.DATE = agentBadge.earnedAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }

    const image = await badgeImageService.generateBadgeImage({
      badgeKey,
      agentName: user.name ?? user.email ?? "Agent",
      variables,
    });

    return new NextResponse(image as BodyInit, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${badgeKey}.png"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse(401, "Unauthorized");
    }
    return errorResponse(500, "Failed to generate badge image.");
  }
}
