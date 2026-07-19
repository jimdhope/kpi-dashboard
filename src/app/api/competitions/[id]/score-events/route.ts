import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { prisma } from "@/server/db/client";
import { requireCompetitionScoreLogger } from "@/server/services/authorization";
import { scoreEventService } from "@/server/services/score-event-service";

const correctionSchema = z.object({
  eventId: z.string().min(1),
  reason: z.string().trim().min(3).max(500),
});

function dayRange(value: string | null) {
  if (!value) return undefined;
  const start = new Date(`${value}T00:00:00.000Z`);
  const end = new Date(`${value}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error("Invalid date");
  return { gte: start, lte: end };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const podId = url.searchParams.get("podId");
    if (!podId) return errorResponse(400, "podId is required.");
    await requireCompetitionScoreLogger({ competitionId: id, podId });
    const scoredForDate = dayRange(url.searchParams.get("date"));
    const events = await prisma.scoreEvent.findMany({
      where: {
        competitionId: id,
        ...(podId ? { podId } : {}),
        ...(scoredForDate ? { scoredForDate } : {}),
      },
      orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
      take: 250,
    });
    const userIds = [...new Set(events.flatMap((event) => [event.subjectAgentId, event.recordedById, event.voidedById].filter((value): value is string => Boolean(value))))];
    const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [];
    const names = new Map(users.map((user) => [user.id, user.name]));

    return ok({ events: events.map((event) => ({
      ...event,
      agentName: names.get(event.subjectAgentId) ?? "Unknown agent",
      recordedByName: event.recordedById ? names.get(event.recordedById) ?? "Unknown user" : "System/import",
      voidedByName: event.voidedById ? names.get(event.voidedById) ?? event.voidedById : null,
    })) });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") return errorResponse(403, "Forbidden");
    if (error instanceof Error && error.message === "Invalid date") return errorResponse(400, "Invalid date.");
    console.error("GET competition score events error:", error);
    return errorResponse(401, "Unauthorized");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const payload = correctionSchema.parse(await request.json());
    const event = await prisma.scoreEvent.findUnique({ where: { id: payload.eventId } });
    if (!event || event.competitionId !== id) return errorResponse(404, "Score event not found.");
    const user = await requireCompetitionScoreLogger({ competitionId: id, podId: event.podId });
    const corrected = await scoreEventService.void({ eventId: event.id, voidedById: user.id, reason: payload.reason });
    if (event.externalReference?.startsWith("DailyAchievement:")) {
      const achievementId = event.externalReference.slice("DailyAchievement:".length);
      await prisma.dailyAchievement.deleteMany({ where: { id: achievementId } });
    }
    return ok({ event: corrected });
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(400, "A correction reason of at least 3 characters is required.");
    if (error instanceof Error && error.message === "Forbidden") return errorResponse(403, "Forbidden");
    if (error instanceof Error && error.message.includes("not found or has already been voided")) return errorResponse(409, error.message);
    console.error("PATCH competition score event error:", error);
    return errorResponse(500, "Failed to correct score event.");
  }
}
