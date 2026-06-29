import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { gamificationService } from "@/server/services/gamification-service";

export async function GET(request: Request) {
  try {
    await authService.requireCurrentUser();
    const url = new URL(request.url);
    const year = parseInt(url.searchParams.get("year") ?? String(new Date().getFullYear()), 10);
    const month = parseInt(url.searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);

    const result = await gamificationService.getMonthlyLeaderboard(year, month);
    return ok(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse(401, "Unauthorized");
    }
    return errorResponse(500, "Failed to fetch monthly leaderboard.");
  }
}
