import { z } from "zod";
import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { gamificationService } from "@/server/services/gamification-service";

const schema = z.object({
  year: z.number(),
});

export async function POST(request: Request) {
  try {
    await authService.requireAdmin();
    const body = schema.parse(await request.json());
    const result = await gamificationService.crownYearlyChampion(body.year);
    return ok(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid payload.");
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    if (error instanceof Error && error.message === "No participants found for this year") {
      return errorResponse(404, "No participants found for this year.");
    }
    return errorResponse(500, "Failed to crown champion.");
  }
}
