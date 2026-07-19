import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { prisma } from "@/server/db/client";
import { requireCompetitionScoreLogger } from "@/server/services/authorization";
import { pageParams, pagedResult } from "@/server/http-pagination";

const createSchema = z.object({
  competitionId: z.string().min(1),
  agentId: z.string().min(1),
  podId: z.string().optional(),
  taskId: z.string().min(1),
  taskName: z.string().optional(),
  completed: z.boolean().optional(),
  date: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const competitionId = url.searchParams.get('competitionId');
    const date = url.searchParams.get('date');
    const podId = url.searchParams.get('podId');
    if (!competitionId || !podId) return errorResponse(400, "competitionId and podId are required.");
    await requireCompetitionScoreLogger({ competitionId, podId });
    const { limit, offset, take } = pageParams(url.searchParams, { defaultLimit: 500, maxLimit: 1000 });

    const where: any = {};
    if (competitionId) where.competitionId = competitionId;
    if (podId) where.podId = podId;
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      where.date = { gte: startDate, lt: endDate };
    }

    const taskLogs = await prisma.dailyTaskLog.findMany({
      where,
      orderBy: { date: 'desc' },
      skip: offset,
      take,
    });

    const page = pagedResult(taskLogs, limit, offset);
    return ok({ taskLogs: page.items, pagination: page.pagination });
  } catch (error) {
    console.error('GET /api/task-logs error:', error);
    return errorResponse(401, "Unauthorized");
  }
}

export async function POST(request: Request) {
  try {
    const payload = createSchema.parse(await request.json());
    if (!payload.podId) return errorResponse(400, "podId is required.");
    await requireCompetitionScoreLogger({ competitionId: payload.competitionId, podId: payload.podId });

    const taskLog = await prisma.dailyTaskLog.create({
      data: {
        competitionId: payload.competitionId,
        agentId: payload.agentId,
        podId: payload.podId || null,
        taskId: payload.taskId,
        taskName: payload.taskName || null,
        completed: payload.completed ?? false,
        date: new Date(payload.date),
      },
    });

    return ok({ taskLog }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid task log payload.");
    }
    if (error instanceof Error && error.message === "Forbidden") return errorResponse(403, "Forbidden");
    console.error('POST /api/task-logs error:', error);
    return errorResponse(500, "Failed to create task log.");
  }
}
