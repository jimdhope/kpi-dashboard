import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";
import { errorResponse } from "@/server/http";
import { prisma } from "@/server/db/client";
import { authService } from "@/server/services/auth-service";
import { BadgeTemplate, type BadgeTemplateProps } from "@/components/kb/badge-template";

type BadgeTemplateVariables = Omit<BadgeTemplateProps, 'agentName' | 'type' | 'iconColor' | 'glowColor'>;

function loadFont(name: string) {
  return readFileSync(join(process.cwd(), "public/fonts", name));
}

const fonts = [
  { name: 'Lexend', data: loadFont('lexend-400.ttf'), weight: 400 as const, style: 'normal' as const },
  { name: 'Lexend', data: loadFont('lexend-500.ttf'), weight: 500 as const, style: 'normal' as const },
  { name: 'Lexend', data: loadFont('lexend-700.ttf'), weight: 700 as const, style: 'normal' as const },
  { name: 'Lexend', data: loadFont('lexend-900.ttf'), weight: 900 as const, style: 'normal' as const },
];

function getRankColors(rank: number) {
  if (rank === 1) return { fill: "#9f8f5eff", stroke: "#7a6c40ff", position: "1st" };
  if (rank === 2) return { fill: "#969696ff", stroke: "#6a6a6aff", position: "2nd" };
  return { fill: "#996b4fff", stroke: "#7a4a33ff", position: "3rd" };
}

export async function GET(request: Request, { params }: { params: Promise<{ badgeKey: string }> }) {
  try {
    const user = await authService.requireCurrentUser();
    const { badgeKey } = await params;
    const { searchParams } = new URL(request.url);
    const overrideRank = searchParams.get("rank");
    const overrideStreak = searchParams.get("streak");
    const overrideMonth = searchParams.get("month");
    const overrideYear = searchParams.get("year");
    const overrideAgentName = searchParams.get("agentName");
    const overrideCompetitionName = searchParams.get("competitionName");

    const badge = await prisma.badge.findUnique({ where: { key: badgeKey } });

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

    const variables: BadgeTemplateVariables = {
      ICON: badge?.icon ?? "🏆",
      BADGE_NAME: badge?.name ?? badgeKey,
      COMPETITION_NAME: "",
      DATE: "",
      POSITION: "",
      STREAK: "",
      MONTH: "",
      YEAR: "",
    };

    const hasOverride = overrideMonth && overrideYear;

    // Common theme colors
    const iconColor = "#ffffff";
    const glowColor = "";

    if (hasOverride) {
      if (overrideCompetitionName) {
        variables.COMPETITION_NAME = overrideCompetitionName;
      }

      if (overrideStreak) {
        variables.STREAK = overrideStreak;
      }

      let rank = 1;
      if (badge?.rankTinted) {
        if (overrideRank) {
          rank = parseInt(overrideRank, 10);
        } else if (ctx.rank) {
          rank = (ctx.rank as number);
        }
        const colors = getRankColors(rank);
        variables.POSITION = colors.position;
      }

      const monthNum = parseInt(overrideMonth, 10);
      const yearNum = parseInt(overrideYear, 10);
      variables.MONTH = new Date(yearNum, monthNum - 1).toLocaleString("default", { month: "long" });
      variables.YEAR = String(yearNum);

      variables.DATE = new Date(yearNum, monthNum - 1).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      });

      let agentName = overrideAgentName || (user.name ?? user.email ?? "Winner");
      agentName = agentName.split(' ')[0];

      const type = badge?.rankTinted ? (rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze') : 'gold';

      return new ImageResponse(
        <BadgeTemplate 
          agentName={agentName}
          {...variables} 
          type={type}
          iconColor={iconColor}
          glowColor={glowColor}
        />,
        {
          width: 1200,
          height: 1200,
          fonts,
        }
      ) as any;
    }

    // Non-override logic
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

    if (overrideStreak) {
      variables.STREAK = overrideStreak;
    }

    if (badge?.rankTinted) {
      let rank = 1;
      if (overrideRank) {
        rank = parseInt(overrideRank, 10);
      } else if (ctx.rank) {
        rank = (ctx.rank as number);
      }
      const colors = getRankColors(rank);
      variables.POSITION = colors.position;
    }

    if (badge?.scope === "MONTHLY" || badge?.scope === "YEARLY") {
      const monthNum = (ctx.month as number) ?? new Date().getMonth() + 1;
      const yearNum = (ctx.year as number) ?? new Date().getFullYear();
      variables.MONTH = new Date(yearNum, monthNum - 1).toLocaleString("default", { month: "long" });
      variables.YEAR = String(yearNum);
    }

    if (agentBadge?.earnedAt) {
      variables.DATE = agentBadge.earnedAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      });
    }

    let rank = 1;
    if (badge?.rankTinted) {
      rank = (ctx.rank as number) ?? 1;
    }
    const type = badge?.rankTinted ? (rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze') : 'gold';

    return new ImageResponse(
      <BadgeTemplate 
        agentName={(user.name ?? user.email ?? "Agent").split(' ')[0]}
        {...variables} 
        type={type}
        iconColor={iconColor}
        glowColor={glowColor}
      />,
      {
        width: 1200,
        height: 1200,
        fonts,
      }
    ) as any;

  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse(401, "Unauthorized");
    }
    console.error("Badge generation error:", error);
    return errorResponse(500, "Failed to generate badge image.");
  }
}
