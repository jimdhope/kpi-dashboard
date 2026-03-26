import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { competitionDraftService } from "@/server/services/competition-draft-service";

const createSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(2000).optional().nullable(),
  draftData: z.any().optional(),
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
    
    const draft = await competitionDraftService.create({
      name: payload.name,
      description: payload.description ?? undefined,
      draftData: payload.draftData,
    });

    return ok({ draft }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid draft payload.");
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    console.error('POST /api/competitions/drafts error:', error);
    return errorResponse(500, "Failed to create draft.");
  }
}
