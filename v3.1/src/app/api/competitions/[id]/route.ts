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
});

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { competitionService } = await import("@/server/services/competition-service");
    const competitions = await competitionService.listCompetitions(true);
    const competition = competitions.find(c => c.id === id);
    
    if (!competition) {
      return errorResponse(404, "Competition not found");
    }
    
    return ok({ competition });
  } catch (error) {
    console.error('GET /api/competitions/[id] error:', error);
    return errorResponse(401, "Unauthorized");
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = schema.parse(await request.json());
    return ok(await competitionService.updateCompetition(id, payload));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid competition payload.");
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    if (error instanceof Error) {
      return errorResponse(400, error.message);
    }
    return errorResponse(500, "Failed to update competition.");
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await competitionService.deleteCompetition(id);
    return ok({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    console.error('DELETE /api/competitions/[id] error:', error);
    return errorResponse(500, "Failed to delete competition.");
  }
}
