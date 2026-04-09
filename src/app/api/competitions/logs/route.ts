import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { competitionService } from "@/server/services/competition-service";

const schema = z.object({
  competitionId: z.string().min(1),
  userId: z.string().optional().nullable(),
  score: z.number().int(),
});

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    return ok(await competitionService.logScore(payload), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid competition score payload.");
    }
    if (error instanceof Error) {
      return errorResponse(400, error.message);
    }
    return errorResponse(500, "Failed to log competition score.");
  }
}
