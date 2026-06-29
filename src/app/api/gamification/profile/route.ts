import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { gamificationService } from "@/server/services/gamification-service";

export async function GET() {
  try {
    const user = await authService.requireCurrentUser();
    const profile = await gamificationService.getAgentProfile(user.id);
    if (!profile) {
      return ok({ profile: null });
    }
    return ok({ profile });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse(401, "Unauthorized");
    }
    return errorResponse(500, "Failed to fetch profile.");
  }
}
