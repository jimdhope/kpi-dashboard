import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { competitionEntryService } from "@/server/services/competition-entry-service";
import { authService } from "@/server/services/auth-service";
import { requireCompetitionEditor } from "@/server/services/authorization";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entries = await competitionEntryService.listByCompetition(id);
    return ok({ entries });
  } catch (error) {
    console.error('GET /api/competitions/[id]/entries error:', error);
    return errorResponse(401, "Unauthorized");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireCompetitionEditor();

    const { id } = await params;
    const body = await request.json();
    const userId = body.userId;

    if (!userId) {
      return errorResponse(400, "userId is required");
    }

    const entry = await competitionEntryService.enrollUser(id, userId);
    return ok({ entry }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    if (error instanceof Error) {
      return errorResponse(400, error.message);
    }
    console.error('POST /api/competitions/[id]/entries error:', error);
    return errorResponse(500, "Failed to enroll user.");
  }
}
