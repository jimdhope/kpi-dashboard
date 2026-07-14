import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { competitionEntryService } from "@/server/services/competition-entry-service";
import { authService } from "@/server/services/auth-service";

const scoreSchema = z.object({
  ruleId: z.string().optional(),
  value: z.number().int(),
  isBonus: z.boolean().optional(),
  bonusTeamId: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    await authService.requireCurrentUser();

    const body = await request.json();
    const payload = scoreSchema.parse(body);
    const { entryId } = await params;

    const entry = await competitionEntryService.logScore({
      entryId,
      ruleId: payload.ruleId,
      value: payload.value,
      isBonus: payload.isBonus,
      bonusTeamId: payload.bonusTeamId,
    });

    return ok({ entry });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid score payload.");
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    if (error instanceof Error) {
      return errorResponse(400, error.message);
    }
    console.error('POST /api/competitions/[id]/entries/[entryId]/score error:', error);
    return errorResponse(500, "Failed to log score.");
  }
}
