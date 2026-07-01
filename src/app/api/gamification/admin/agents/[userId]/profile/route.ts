import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { gamificationService } from "@/server/services/gamification-service";

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await authService.requireAdmin();
    const { userId } = await params;
    const profile = await gamificationService.getAgentProfile(userId);
    if (!profile) {
      return errorResponse(404, "Agent profile not found.");
    }
    return ok({ profile });
  } catch (error) {
    if (error instanceof Error && error.message === "Agent profile not found") {
      return errorResponse(404, "Agent profile not found.");
    }
    return errorResponse(500, "Failed to fetch agent profile.");
  }
}
