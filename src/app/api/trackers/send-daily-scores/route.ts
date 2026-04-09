import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { authService } from "@/server/services/auth-service";
import { ok, errorResponse } from "@/server/http";
import { buildTrackerScoresAdaptiveCard, TrackerScoresCardData, TrackerAgentScore } from "@/server/services/tracker-teams-card-service";
import { teamsWebhookService } from "@/server/services/teams-webhook-service";

interface TrackerLog {
  userId: string;
  trackerKpiId: string;
  value: number;
}

// UTC-based start/end of day
function startOfDayUTC(dateStr: string): Date {
  const date = new Date(dateStr);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function endOfDayUTC(dateStr: string): Date {
  const date = new Date(dateStr);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

/**
 * GET /api/trackers/send-daily-scores
 * Returns available outgoing webhooks and agent scores for the selected date
 */
export async function GET(request: NextRequest) {
  try {
    const session = await authService.getCurrentSession();
    const userRoles = session.user?.roles || [];
    const isAuthorized = userRoles.includes('admin') || userRoles.includes('teamLeader') || userRoles.includes('podManager');
    if (!session.user || !isAuthorized) {
      return errorResponse(403, "Forbidden");
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return errorResponse(400, "Date parameter is required");
    }

    // Get all active outgoing webhooks
    const allWebhooks = await teamsWebhookService.listWebhooks();
    const outgoingWebhooks = allWebhooks.filter(w => w.direction === "outgoing" && w.isActive);

    // Get all tracker KPIs
    const kpis = await prisma.trackerKpi.findMany({
      select: { id: true, name: true, unit: true },
      orderBy: { name: 'asc' },
    });

    // Get all pods with their members
    const pods = await prisma.pod.findMany({
      include: {
        memberships: {
          select: { userId: true },
        },
      },
    });

    // Get logs for the selected date across all pods
    const logs = await prisma.trackerLog.findMany({
      where: {
        loggedAt: { gte: startOfDayUTC(date), lte: endOfDayUTC(date) },
      },
      select: { userId: true, trackerKpiId: true, value: true },
    });

    // Get all agent user IDs from pods
    const allAgentIds = [...new Set(pods.flatMap(p => p.memberships.map(m => m.userId)))];

    // Get agent names
    const agentNameMap = new Map<string, string>();
    const users = await prisma.user.findMany({
      where: { id: { in: allAgentIds } },
      select: { id: true, name: true },
    });
    for (const user of users) {
      agentNameMap.set(user.id, user.name);
    }

    // Build agent scores - only include agents who have logged achievements (value > 0)
    const agentScores: TrackerAgentScore[] = allAgentIds
      .filter(agentId => agentNameMap.has(agentId))
      .map(agentId => {
        const agentLogs = logs.filter(l => l.userId === agentId);
        const scores: Record<string, number> = {};
        
        kpis.forEach(kpi => {
          const log = agentLogs.find(l => l.trackerKpiId === kpi.id);
          scores[kpi.id] = log ? Number(log.value) : 0;
        });

        return {
          agentId,
          agentName: agentNameMap.get(agentId) || 'Unknown',
          scores,
        };
      })
      // Filter to only include agents with at least one achievement (value > 0)
      .filter(agent => Object.values(agent.scores).some(v => v > 0))
      .sort((a, b) => a.agentName.localeCompare(b.agentName));

    return ok({
      webhooks: outgoingWebhooks.map(w => ({
        id: w.id,
        name: w.name,
        friendlyName: w.friendlyName,
      })),
      date,
      kpis: kpis.map(k => ({
        id: k.id,
        name: k.name,
        unit: k.unit,
      })),
      agents: agentScores,
    });
  } catch (error) {
    console.error("GET /api/trackers/send-daily-scores error:", error);
    return errorResponse(500, "Failed to get tracker scores for Teams");
  }
}

/**
 * POST /api/trackers/send-daily-scores
 * Sends tracker scores to Teams via webhook
 */
export async function POST(request: NextRequest) {
  try {
    const session = await authService.getCurrentSession();
    const userRoles = session.user?.roles || [];
    const isAuthorized = userRoles.includes('admin') || userRoles.includes('teamLeader') || userRoles.includes('podManager');
    if (!session.user || !isAuthorized) {
      return errorResponse(403, "Forbidden");
    }

    const body = await request.json();
    const { date, webhookId } = body as { date: string; webhookId: string };

    if (!date || !webhookId) {
      return errorResponse(400, "Date and webhookId are required");
    }

    // Get the webhook
    const webhook = await prisma.teamsWebhookEndpoint.findUnique({
      where: { id: webhookId },
    });

    if (!webhook || !webhook.isActive) {
      return errorResponse(400, "Webhook not found or inactive");
    }

    // Get all tracker KPIs
    const kpis = await prisma.trackerKpi.findMany({
      select: { id: true, name: true, unit: true },
      orderBy: { name: 'asc' },
    });

    // Get all pods with their members
    const pods = await prisma.pod.findMany({
      include: {
        memberships: {
          select: { userId: true },
        },
      },
    });

    // Get logs for the selected date
    const logs = await prisma.trackerLog.findMany({
      where: {
        loggedAt: { gte: startOfDayUTC(date), lte: endOfDayUTC(date) },
      },
      select: { userId: true, trackerKpiId: true, value: true },
    });

    // Get all agent user IDs from pods
    const allAgentIds = [...new Set(pods.flatMap(p => p.memberships.map(m => m.userId)))];

    // Get agent names
    const agentNameMap = new Map<string, string>();
    const users = await prisma.user.findMany({
      where: { id: { in: allAgentIds } },
      select: { id: true, name: true },
    });
    for (const user of users) {
      agentNameMap.set(user.id, user.name);
    }

    // Build agent scores - only include agents who have logged achievements (value > 0)
    const agentScores: TrackerAgentScore[] = allAgentIds
      .filter(agentId => agentNameMap.has(agentId))
      .map(agentId => {
        const agentLogs = logs.filter(l => l.userId === agentId);
        const scores: Record<string, number> = {};
        
        kpis.forEach(kpi => {
          const log = agentLogs.find(l => l.trackerKpiId === kpi.id);
          scores[kpi.id] = log ? Number(log.value) : 0;
        });

        return {
          agentId,
          agentName: agentNameMap.get(agentId) || 'Unknown',
          scores,
        };
      })
      // Filter to only include agents with at least one achievement (value > 0)
      .filter(agent => Object.values(agent.scores).some(v => v > 0))
      .sort((a, b) => a.agentName.localeCompare(b.agentName));

    // Build the card data
    const cardData: TrackerScoresCardData = {
      date: new Date(date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      kpis: kpis.map(k => ({
        id: k.id,
        name: k.name,
        unit: k.unit || undefined,
      })),
      agents: agentScores,
    };

    const card = buildTrackerScoresAdaptiveCard(cardData);

    // Send to webhook
    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(card),
      });

      if (!response.ok && response.status !== 200) {
        return errorResponse(500, `Failed to send to Teams: HTTP ${response.status}`);
      }

      return ok({
        success: true,
        sentTo: webhook.friendlyName || webhook.name,
        agentCount: agentScores.length,
        kpiCount: kpis.length,
      });
    } catch (err) {
      console.error("Failed to send to Teams webhook:", err);
      return errorResponse(500, `Failed to send to Teams: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  } catch (error) {
    console.error("POST /api/trackers/send-daily-scores error:", error);
    return errorResponse(500, "Failed to send tracker scores to Teams");
  }
}