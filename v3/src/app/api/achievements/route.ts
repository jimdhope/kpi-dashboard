import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { prisma } from "@/server/db/client";

const createSchema = z.object({
  competitionId: z.string().min(1),
  agentId: z.string().min(1),
  podId: z.string().min(1),
  ruleId: z.string().min(1),
  ruleName: z.string().optional(),
  value: z.number().int().min(0),
  points: z.number().int().optional(),
  date: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    await authService.requireCurrentUser();
    const url = new URL(request.url);
    const competitionId = url.searchParams.get('competitionId');
    const date = url.searchParams.get('date');
    const podId = url.searchParams.get('podId');

    const where: any = {};
    if (competitionId) where.competitionId = competitionId;
    if (podId) where.podId = podId;
    if (date) {
      // Filter by date: match the entire day in UTC to avoid timezone issues with string comparisons
      const dayStart = new Date(date);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setUTCHours(23, 59, 59, 999);
      
      where.date = { gte: dayStart, lte: dayEnd };
    }

    const achievements = await prisma.dailyAchievement.findMany({
      where,
      orderBy: { loggedAt: 'desc' },
    });

    return ok({ achievements });
  } catch (error) {
    console.error('GET /api/achievements error:', error);
    return errorResponse(401, "Unauthorized");
  }
}

export async function POST(request: Request) {
  try {
    const user = await authService.requireCurrentUser();
    const payload = createSchema.parse(await request.json());

    const targetDate = new Date(payload.date);
    targetDate.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(payload.date);
    dayEnd.setUTCHours(23, 59, 59, 999);

    // Look for existing achievement to update (upsert)
    const existing = await prisma.dailyAchievement.findFirst({
      where: {
        competitionId: payload.competitionId,
        agentId: payload.agentId,
        ruleId: payload.ruleId,
        date: { gte: targetDate, lte: dayEnd }
      }
    });

    let achievement;
    if (existing) {
      achievement = await prisma.dailyAchievement.update({
        where: { id: existing.id },
        data: {
          value: payload.value,
          points: payload.points ?? payload.value,
          ruleName: payload.ruleName || existing.ruleName,
          loggedBy: user.id,
          loggedAt: new Date(),
        }
      });
    } else {
      achievement = await prisma.dailyAchievement.create({
        data: {
          competitionId: payload.competitionId,
          agentId: payload.agentId,
          podId: payload.podId,
          ruleId: payload.ruleId,
          ruleName: payload.ruleName || null,
          value: payload.value,
          points: payload.points ?? payload.value,
          date: targetDate,
          loggedBy: user.id,
          loggedAt: new Date(),
        },
      });
    }

    return ok({ achievement }, { status: existing ? 200 : 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid achievement payload.");
    }
    console.error('POST /api/achievements error:', error);
    return errorResponse(500, "Failed to create achievement.");
  }
}
