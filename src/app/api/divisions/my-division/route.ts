import { errorResponse, ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { getMyDivisionCard } from "@/server/services/division-view-service";

export async function GET() {
  try {
    const session = await authService.getCurrentSession();
    const userId = session.user?.id;
    if (!userId) return errorResponse(401, "Unauthorized");
    return ok(await getMyDivisionCard(userId));
  } catch (error) {
    console.error("GET /api/divisions/my-division error:", error);
    return errorResponse(500, "Failed to load division card.");
  }
}
