import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { gamificationService } from "@/server/services/gamification-service";

export async function GET() {
  try {
    await authService.requireAdmin();
    const stats = await gamificationService.getAdminStats();
    return ok(stats);
  } catch {
    return errorResponse(500, "Failed to fetch admin stats.");
  }
}
