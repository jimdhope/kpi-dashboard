import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { competitionDraftService } from "@/server/services/competition-draft-service";
import { authService } from "@/server/services/auth-service";

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(2000).optional().nullable(),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const draft = await competitionDraftService.getById(id);
    if (!draft) {
      return errorResponse(404, "Draft not found");
    }
    return ok({ draft });
  } catch (error) {
    console.error('GET /api/competitions/drafts/[id] error:', error);
    return errorResponse(401, "Unauthorized");
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await authService.requireCurrentUser();
    const { id } = await params;
    const body = await request.json();
    const payload = updateSchema.parse(body);

    const draft = await competitionDraftService.update(id, {
      name: payload.name,
      description: payload.description ?? undefined,
      startsAt: payload.startsAt ? new Date(payload.startsAt) : null,
      endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
      draftData: payload.draftData,
      rules: payload.rules,
      teams: payload.teams,
      campaignId: payload.campaignId ?? undefined,
      podIds: payload.podIds ?? undefined,
    });

    return ok({ draft });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid draft payload.");
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    if (error instanceof Error && error.message === "Campaign not found") {
      return errorResponse(400, "Selected campaign no longer exists. Please select a different campaign.");
    }
    console.error('PUT /api/competitions/drafts/[id] error:', error);
    return errorResponse(500, "Failed to update draft.");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await authService.requireCurrentUser();
    const { id } = await params;
    await competitionDraftService.delete(id);
    return ok({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    console.error('DELETE /api/competitions/drafts/[id] error:', error);
    return errorResponse(500, "Failed to delete draft.");
  }
}
