import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { authService } from "@/server/services/auth-service";
import { ok, errorResponse } from "@/server/http";
import { buildDailyScoresAdaptiveCard, DailyScoresCardData, PodStandingsForTeams } from "@/server/services/competition-teams-card-service";

interface PodWithWebhook {
  id: string;
  name: string;
  outgoingWebhookId: string | null;
  outgoingWebhook: {
    id: string;
    url: string;
    isActive: boolean;
  } | null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await authService.getCurrentSession();
    const userRoles = session.user?.roles || [];
    const isAuthorized = userRoles.includes('admin') || userRoles.includes('teamLeader') || userRoles.includes('podManager');
    if (!session.user || !isAuthorized) {
      return errorResponse(403, "Forbidden");
    }

    const { id: competitionId } = await params;
    const body = await request.json();
    const { date, podIds } = body as { date: string; podIds: string[] };

    if (!date || !podIds || !Array.isArray(podIds)) {
      return errorResponse(400, "Invalid request: date and podIds are required");
    }

    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      include: {
        entries: {
          include: {
            user: {
              include: {
                podMemberships: {
                  include: {
                    pod: true,
                  },
                },
              },
            },
            scoreLogs: {
              where: {
                createdAt: {
                  gte: new Date(`${date}T00:00:00.000Z`),
                  lt: new Date(`${date}T23:59:59.999Z`),
                },
              },
            },
          },
        },
      },
    });

    if (!competition) {
      return errorResponse(404, "Competition not found");
    }

    const pods = await prisma.pod.findMany({
      where: { id: { in: podIds } },
      include: {
        outgoingWebhook: true,
      },
    }) as PodWithWebhook[];

    const sentTo: string[] = [];
    const failed: string[] = [];

    for (const pod of pods) {
      if (!pod.outgoingWebhook || !pod.outgoingWebhook.isActive) {
        failed.push(`${pod.name} - webhook not configured or inactive`);
        continue;
      }

      const agentsInPod = competition.entries.filter((entry: any) => {
        if (!entry.user) return false;
        return entry.user.podMemberships.some((m: any) => m.podId === pod.id);
      });

      const agentStandings = agentsInPod
        .map((entry: any) => ({
          agentId: entry.userId!,
          agentName: entry.user!.name,
          score: entry.score,
        }))
        .sort((a: any, b: any) => b.score - a.score)
        .map((standing: any, index: number) => ({
          ...standing,
          rank: index + 1,
        }));

      const podStandings: PodStandingsForTeams = {
        podId: pod.id,
        podName: pod.name,
        agents: agentStandings,
        hasWebhook: !!pod.outgoingWebhook,
      };

      const cardData: DailyScoresCardData = {
        competitionName: competition.name,
        date: new Date(date).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        pods: [podStandings],
      };

      const card = buildDailyScoresAdaptiveCard(cardData);

      try {
        const response = await fetch(pod.outgoingWebhook.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(card),
        });

        if (response.ok || response.status === 200) {
          sentTo.push(pod.name);
        } else {
          failed.push(`${pod.name} - HTTP ${response.status}`);
        }
      } catch (err) {
        failed.push(`${pod.name} - ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    return ok({
      success: sentTo.length > 0,
      sentTo,
      failed,
      totalSent: sentTo.length,
      totalFailed: failed.length,
    });
  } catch (error) {
    console.error("POST /api/competitions/[id]/send-daily-scores error:", error);
    return errorResponse(500, "Failed to send daily scores to Teams");
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await authService.getCurrentSession();
    const userRoles = session.user?.roles || [];
    const isAuthorized = userRoles.includes('admin') || userRoles.includes('teamLeader') || userRoles.includes('podManager');
    if (!session.user || !isAuthorized) {
      return errorResponse(403, "Forbidden");
    }

    const { id: competitionId } = await params;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return errorResponse(400, "Date parameter is required");
    }

    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      include: {
        entries: {
          include: {
            user: {
              include: {
                podMemberships: {
                  include: {
                    pod: true,
                  },
                },
              },
            },
            scoreLogs: {
              where: {
                createdAt: {
                  gte: new Date(`${date}T00:00:00.000Z`),
                  lt: new Date(`${date}T23:59:59.999Z`),
                },
              },
            },
          },
        },
      },
    });

    if (!competition) {
      return errorResponse(404, "Competition not found");
    }

    const podsInCompetition = await prisma.pod.findMany({
      where: { id: { in: competition.podIds } },
      include: {
        outgoingWebhook: true,
      },
    }) as PodWithWebhook[];

    const podsWithAgents = podsInCompetition.map(pod => {
      const agentsInPod = competition.entries.filter((entry: any) => {
        if (!entry.user) return false;
        return entry.user.podMemberships.some((m: any) => m.podId === pod.id);
      });

      const agentStandings = agentsInPod
        .map((entry: any) => ({
          agentId: entry.userId!,
          agentName: entry.user!.name,
          score: entry.score,
          hasActivity: entry.scoreLogs.length > 0,
        }))
        .sort((a: any, b: any) => b.score - a.score)
        .map((standing: any, index: number) => ({
          ...standing,
          rank: index + 1,
        }));

      return {
        podId: pod.id,
        podName: pod.name,
        agents: agentStandings,
        hasWebhook: !!pod.outgoingWebhook && pod.outgoingWebhook.isActive,
        webhookConfigured: !!pod.outgoingWebhook,
        webhookActive: pod.outgoingWebhook?.isActive ?? false,
      };
    });

    return ok({ pods: podsWithAgents });
  } catch (error) {
    console.error("GET /api/competitions/[id]/send-daily-scores error:", error);
    return errorResponse(500, "Failed to get pod standings for Teams");
  }
}
