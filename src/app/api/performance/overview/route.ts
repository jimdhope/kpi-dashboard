import { errorResponse, ok } from "@/server/http";
import { performanceService } from "@/server/services/performance-service";

export async function GET() {
  try {
    return ok(await performanceService.getOverview());
  } catch {
    return errorResponse(401, "Unauthorized");
  }
}
