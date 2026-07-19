import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { prisma } from "@/server/db/client";
import { requireCompetitionScoreLogger } from "@/server/services/authorization";
import { pageParams, pagedResult } from "@/server/http-pagination";

const createSchema = z.object({
  competitionId: z.string().min(1),
  teamId: z.string().min(1),
  teamName: z.string().optional(),
  podId: z.string().optional(),
  points: z.number().int(),
  reason: z.string().optional(),
  date: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    await authService.requireCurrentUser();
    const url = new URL(request.url);
    const competitionId = url.searchParams.get('competitionId');
    const date = url.searchParams.get('date');
    const { limit, offset, take } = pageParams(url.searchParams, { defaultLimit: 500, maxLimit: 1000 });

    const where: any = {};
    if (competitionId) where.competitionId = competitionId;
    if (date) {
      const dayStart = new Date(date);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setUTCHours(23, 59, 59, 999);
      where.date = { gte: dayStart, lte: dayEnd };
    }

    const bonusLogs = await prisma.teamBonusLog.findMany({
      where,
      orderBy: { date: 'desc' },
      skip: offset,
      take,
    });

    const page = pagedResult(bonusLogs, limit, offset);
    return ok({ bonusLogs: page.items, pagination: page.pagination });
  } catch (error) {
    console.error('GET /api/bonus-logs error:', error);
    return errorResponse(401, "Unauthorized");
  }
}

export async function POST(request: Request) {
  try {
    const payload = createSchema.parse(await request.json());
    if (!payload.podId) return errorResponse(400, "podId is required.");
    const user = await requireCompetitionScoreLogger({ competitionId: payload.competitionId, podId: payload.podId });

    const targetDate = new Date(payload.date);
    targetDate.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(payload.date);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const existing = await prisma.teamBonusLog.findFirst({
      where: {
        competitionId: payload.competitionId,
        teamId: payload.teamId,
        date: { gte: targetDate, lte: dayEnd }
      }
    });

    let bonusLog;
    if (existing) {
      bonusLog = await prisma.teamBonusLog.update({
        where: { id: existing.id },
        data: {
          points: payload.points,
          reason: payload.reason || existing.reason,
          loggedBy: user.id,
          loggedAt: new Date(),
        }
      });
    } else {
      bonusLog = await prisma.teamBonusLog.create({
        data: {
          competitionId: payload.competitionId,
          teamId: payload.teamId,
          teamName: payload.teamName || null,
          podId: payload.podId || null,
          points: payload.points,
          reason: payload.reason || null,
          date: targetDate,
          loggedBy: user.id,
          loggedAt: new Date(),
        },
      });
    }

    return ok({ bonusLog }, { status: existing ? 200 : 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid bonus log payload.");
    }
    if (error instanceof Error && error.message === "Forbidden") return errorResponse(403, "Forbidden");
    console.error('POST /api/bonus-logs error:', error);
    return errorResponse(500, "Failed to create bonus log.");
  }
}
