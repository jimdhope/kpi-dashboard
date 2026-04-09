import { errorResponse, ok } from "@/server/http";
import { dashboardService } from "@/server/services/dashboard-service";

export async function GET() {
  try {
    return ok(await dashboardService.getDashboard());
  } catch {
    return errorResponse(401, "Unauthorized");
  }
}
