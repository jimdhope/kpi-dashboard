import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { gamificationService } from "@/server/services/gamification-service";

export async function POST() {
  try {
    await authService.requireAdmin();
    const results = await gamificationService.assignEntriesForAll();
    return ok({ results });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    return errorResponse(500, "Failed to assign entries.");
  }
}
