import { errorResponse, ok } from "@/server/http";
import { competitionService } from "@/server/services/competition-service";

export async function GET() {
  try {
    return ok(await competitionService.getSummaries());
  } catch {
    return errorResponse(401, "Unauthorized");
  }
}
