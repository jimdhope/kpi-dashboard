import { errorResponse, ok } from "@/server/http";
import { agentDashboardService } from "@/server/services/agent-dashboard-service";

export async function GET(request: Request) {
  try {
    const competitionId = new URL(request.url).searchParams.get("competitionId");
    return ok(await agentDashboardService.getData(competitionId));
  } catch (error) {
    console.error("GET /api/dashboard/agent error:", error);
    return errorResponse(500, "Failed to load agent dashboard.");
  }
}
