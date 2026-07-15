import { errorResponse, ok } from "@/server/http";
import { agentDashboardService } from "@/server/services/agent-dashboard-service";

export async function GET() {
  try {
    return ok(await agentDashboardService.getData());
  } catch (error) {
    console.error("GET /api/dashboard/agent error:", error);
    return errorResponse(500, "Failed to load agent dashboard.");
  }
}
