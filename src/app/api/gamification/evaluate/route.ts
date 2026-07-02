import { z } from "zod";
import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { gamificationService } from "@/server/services/gamification-service";

const schema = z.object({
  competitionIds: z.array(z.string()).optional(),
  allPending: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    await authService.requireAdmin();
    const body = schema.parse(await request.json());

    let summaries;
    if (body.allPending) {
      summaries = await gamificationService.retroactivelyEvaluateAll();
    } else if (body.competitionIds) {
      summaries = [];
      for (const id of body.competitionIds) {
        const summary = await gamificationService.evaluateCompetitionEnd(id);
        summaries.push(summary);
      }
    } else {
      return errorResponse(400, "Provide competitionIds or allPending.");
    }

    return ok({ summaries });
  } catch (error) {
    console.error("Gamification evaluation failed:", error);
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid payload.");
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    return errorResponse(500, "Evaluation failed.");
  }
}

export async function GET() {
  try {
    await authService.requireAdmin();
    const pending = await gamificationService.getPendingCompetitions();
    return ok({ competitions: pending });
  } catch {
    return errorResponse(500, "Failed to fetch pending competitions.");
  }
}
