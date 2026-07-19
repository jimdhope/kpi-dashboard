import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { prisma } from "@/server/db/client";
import { scoreEventService } from "@/server/services/score-event-service";

const createSchema = z.object({
  competitionId: z.string().min(1),
  ruleId: z.string().min(1),
  podId: z.string().min(1),
  quantity: z.number().int().min(1).max(100_000),
  idempotencyKey: z.string().min(8).max(200),
});

export async function GET(request: Request) {
  try {
    const user = await authService.requireCurrentUser();
    const competitionId = new URL(request.url).searchParams.get("competitionId");
    const events = await prisma.scoreEvent.findMany({
      where: {
        subjectAgentId: user.id,
        source: "agent_dashboard",
        voidedAt: null,
        ...(competitionId ? { competitionId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    return ok({ events });
  } catch (error) {
    console.error("GET /api/agent/score-events error:", error);
    return errorResponse(401, "Unauthorized");
  }
}

/** Creates an individual, auditable self-score event. */
export async function POST(request: Request) {
  try {
    const user = await authService.requireCurrentUser();
    const payload = createSchema.parse(await request.json());
    const [competition, rule, membership] = await Promise.all([
      prisma.competition.findUnique({ where: { id: payload.competitionId } }),
      prisma.competitionRule.findUnique({ where: { id: payload.ruleId } }),
      prisma.podMembership.findFirst({ where: { podId: payload.podId, userId: user.id } }),
    ]);

    if (!competition || competition.isDraft || !rule || rule.competitionId !== competition.id) {
      return errorResponse(404, "Competition rule not found.");
    }
    if (!rule.agentCanLog) return errorResponse(403, "Agents cannot log this rule.");
    if (!membership || !competition.podIds.includes(payload.podId)) {
      return errorResponse(403, "You are not eligible to score in this competition pod.");
    }

    const now = new Date();
    if ((competition.startsAt && now < competition.startsAt) || (competition.endsAt && now > competition.endsAt)) {
      return errorResponse(403, "This competition is not currently open for scoring.");
    }

    const scoredForDate = new Date(now);
    scoredForDate.setUTCHours(0, 0, 0, 0);
    const event = await scoreEventService.record({
      competitionId: competition.id,
      ruleId: rule.id,
      ruleName: rule.title,
      subjectAgentId: user.id,
      podId: payload.podId,
      quantity: payload.quantity,
      points: payload.quantity * rule.points,
      scoredForDate,
      source: "agent_dashboard",
      recordedById: user.id,
      idempotencyKey: payload.idempotencyKey,
    });

    return ok({ event }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(400, "Invalid score payload.");
    console.error("POST /api/agent/score-events error:", error);
    return errorResponse(500, "Failed to record score.");
  }
}
