import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { competitionService } from "@/server/services/competition-service";

const schema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional().nullable(),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
  rules: z.array(
    z.object({
      title: z.string().min(1).max(120),
      points: z.number().int(),
      isCheckbox: z.boolean().optional(),
      emoji: z.string().optional().nullable(),
      dailyTarget: z.number().int().optional().nullable(),
    }),
  ),
  teams: z.array(
    z.object({
      name: z.string().min(1).max(120),
      agentIds: z.array(z.string()).optional(),
      emoji: z.string().optional().nullable(),
    }),
  ),
  isDraft: z.boolean().optional(),
  campaignId: z.string().optional().nullable(),
  podIds: z.array(z.string()).optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const includeDrafts = url.searchParams.get('includeDrafts') === 'true';
    const competitions = await competitionService.listCompetitions(includeDrafts);
    return ok({ competitions });
  } catch (error) {
    console.error('GET /api/competitions error:', error);
    return errorResponse(401, "Unauthorized");
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    console.log('[POST /api/competitions] Creating competition:', { name: payload.name, rulesCount: payload.rules?.length });
    const competition = await competitionService.createCompetition(payload);
    console.log('[POST /api/competitions] Created:', competition.id);
    return ok(competition, { status: 201 });
  } catch (error) {
    console.error('[POST /api/competitions] Error:', error);
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid competition payload.");
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden - You don't have permission to create competitions");
    }
    if (error instanceof Error) {
      return errorResponse(400, error.message);
    }
    return errorResponse(500, "Failed to create competition.");
  }
}
