import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { gamificationService } from "@/server/services/gamification-service";

export async function GET(request: Request) {
  try {
    await authService.requireAdmin();
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
    const podId = url.searchParams.get("podId") ?? undefined;

    const result = await gamificationService.getAllTimeLeaderboard(podId, limit, offset);
    return ok(result);
  } catch {
    return errorResponse(500, "Failed to fetch agents.");
  }
}
