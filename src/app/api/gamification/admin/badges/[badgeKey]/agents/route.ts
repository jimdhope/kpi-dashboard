import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { gamificationService } from "@/server/services/gamification-service";

export async function GET(_request: Request, { params }: { params: Promise<{ badgeKey: string }> }) {
  try {
    await authService.requireAdmin();
    const { badgeKey } = await params;
    const agents = await gamificationService.getBadgeAgents(badgeKey);
    return ok({ agents });
  } catch (error) {
    if (error instanceof Error && error.message === "Badge not found") {
      return errorResponse(404, "Badge not found.");
    }
    return errorResponse(500, "Failed to fetch badge agents.");
  }
}
