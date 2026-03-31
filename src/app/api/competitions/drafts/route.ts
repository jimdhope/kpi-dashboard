import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { competitionDraftService } from "@/server/services/competition-draft-service";

const createSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(2000).optional().nullable(),
  draftData: z.any().optional(),
  campaignId: z.string().optional().nullable(),
  podIds: z.array(z.string()).optional(),
  rules: z.array(
    z.object({
      id: z.string().optional(),
      title: z.string().min(1).max(120),
      points: z.number().int(),
      isCheckbox: z.boolean().optional(),
      emoji: z.string().optional().nullable(),
      dailyTarget: z.number().int().optional().nullable(),
    }),
  ).optional(),
  teams: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1).max(120),
      agentIds: z.array(z.string()).optional(),
      emoji: z.string().optional().nullable(),
    }),
  ).optional(),
});

export async function GET() {
  try {
    const drafts = await competitionDraftService.listByUser();
    return ok({ drafts });
  } catch (error) {
    console.error('GET /api/competitions/drafts error:', error);
    return errorResponse(401, "Unauthorized");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = createSchema.parse(body);
    
    // Include campaignId and podIds in draftData
    const draftData = payload.draftData || {};
    if (payload.campaignId) {
      draftData.campaignId = payload.campaignId;
    }
    if (payload.podIds) {
      draftData.podIds = payload.podIds;
    }
    
    console.log('[POST /api/competitions/drafts] Creating draft:', {
      name: payload.name,
      rulesCount: payload.rules?.length || 0,
      teamsCount: payload.teams?.length || 0,
    });

    const draft = await competitionDraftService.create({
      name: payload.name,
      description: payload.description ?? undefined,
      draftData,
      rules: payload.rules,
      teams: payload.teams,
      campaignId: payload.campaignId ?? undefined,
      podIds: payload.podIds ?? undefined,
    });

    console.log('[POST /api/competitions/drafts] Created draft:', draft.id);
    return ok({ draft }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[POST /api/competitions/drafts] Zod validation error:', error);
      return errorResponse(400, "Invalid draft payload.");
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    console.error('[POST /api/competitions/drafts] Error:', error);
    return errorResponse(500, "Failed to create draft.");
  }
}
