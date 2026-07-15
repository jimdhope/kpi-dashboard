import { errorResponse, ok } from "@/server/http";
import { performanceDashboardService } from "@/server/services/performance-dashboard-service";

export async function GET(request: Request) {
  try {
    const podId = new URL(request.url).searchParams.get("podId") || undefined;
    return ok(await performanceDashboardService.getData(podId));
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    console.error("GET /api/performance/dashboard error:", error);
    return errorResponse(500, "Failed to load performance dashboard.");
  }
}
