import { errorResponse, ok } from "@/server/http";
import { reportingService } from "@/server/services/reporting-service";

export async function GET() {
  try {
    return ok(await reportingService.getOverview());
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    return errorResponse(401, "Unauthorized");
  }
}
