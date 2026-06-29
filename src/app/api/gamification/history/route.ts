import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { gamificationService } from "@/server/services/gamification-service";

export async function GET() {
  try {
    const user = await authService.requireCurrentUser();
    const history = await gamificationService.getAgentHistory(user.id);
    return ok(history);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse(401, "Unauthorized");
    }
    return errorResponse(500, "Failed to fetch history.");
  }
}
