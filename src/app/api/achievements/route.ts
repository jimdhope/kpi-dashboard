import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { activityService } from "@/server/services/activity-service";
import { prisma } from "@/server/db/client";
import { requireCompetitionScoreLogger } from "@/server/services/authorization";
import { pageParams, pagedResult } from "@/server/http-pagination";
import { scoreEventMigrationService } from "@/server/services/score-event-migration-service";

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
    const { limit, offset, take } = pageParams(url.searchParams, { defaultLimit: 500, maxLimit: 1000 });

    const where: any = { voidedAt: null };
    if (competitionId) where.competitionId = competitionId;
    if (podId) where.podId = podId;
    if (date) {
      // Filter by date: match the entire day in UTC to avoid timezone issues with string comparisons
      const dayStart = new Date(date);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setUTCHours(23, 59, 59, 999);
      
      where.scoredForDate = { gte: dayStart, lte: dayEnd };
    }

    const scoreEvents = await prisma.scoreEvent.findMany({
      where,
      orderBy: [{ recordedAt: 'desc' }, { createdAt: 'desc' }],
      skip: offset,
      take,
    });

    const page = pagedResult(scoreEvents, limit, offset);

    const agentIds = [...new Set(page.items.map((event) => event.subjectAgentId))];
    const agents = await prisma.user.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true },
    });
    const agentNames = new Map(agents.map((agent) => [agent.id, agent.name]));

    return ok({
      achievements: page.items.map((event) => ({
        id: event.id,
        competitionId: event.competitionId,
        agentId: event.subjectAgentId,
        podId: event.podId,
        ruleId: event.ruleId,
        ruleName: event.ruleName,
        value: event.quantity,
        points: event.points,
        date: event.scoredForDate,
        loggedBy: event.recordedById,
        loggedAt: event.recordedAt,
        createdAt: event.createdAt,
        agentName: agentNames.get(event.subjectAgentId) || 'Unknown',
      })),
      pagination: page.pagination,
    });
  } catch (error) {
    console.error('GET /api/achievements error:', error);
    return errorResponse(401, "Unauthorized");
  }
}

export async function POST(request: Request) {
  try {
     const payload = createSchema.parse(await request.json());
     const user = await requireCompetitionScoreLogger({ competitionId: payload.competitionId, podId: payload.podId });
 
     const targetDate = new Date(payload.date);
     targetDate.setUTCHours(0, 0, 0, 0);
     const dayEnd = new Date(payload.date);
     dayEnd.setUTCHours(23, 59, 59, 999);
 
     // Calculate points. If ruleId is 'na', points are 0.
     let calculatedPoints = 0;
     if (payload.ruleId !== 'na') {
       const rule = await prisma.competitionRule.findUnique({
         where: { id: payload.ruleId }
       });
 
       if (!rule) {
         return errorResponse(400, "Competition rule not found.");
       }
       calculatedPoints = payload.value * rule.points;
     }
 
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
           points: calculatedPoints,
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
           points: calculatedPoints,
           date: targetDate,
           loggedBy: user.id,
           loggedAt: new Date(),
         }
       });
 
       // Log activity for new achievement
       const agent = await prisma.user.findUnique({
         where: { id: payload.agentId },
         select: { name: true },
       });
 
       if (payload.ruleId !== 'na') {
         await activityService.logAchievementEarned({
           achievementName: payload.ruleName || 'Achievement',
           points: calculatedPoints,
           userId: payload.agentId,
           userName: agent?.name || 'Unknown',
         });
       }
     }
 
     await scoreEventMigrationService.syncDailyAchievementById(achievement.id);
     return ok({ achievement }, { status: existing ? 200 : 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid achievement payload.");
    }
    if (error instanceof Error && error.message === "Forbidden") return errorResponse(403, "Forbidden");
    console.error('POST /api/achievements error:', error);
    return errorResponse(500, "Failed to create achievement.");
  }
}
