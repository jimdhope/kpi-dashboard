import { errorResponse, ok } from "@/server/http";
import { managementDashboardService } from "@/server/services/management-dashboard-service";

export async function GET() {
  try {
    return ok(await managementDashboardService.getData());
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    console.error("GET /api/dashboard/management error:", error);
    return errorResponse(500, "Failed to load management dashboard.");
  }
}
