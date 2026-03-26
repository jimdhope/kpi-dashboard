import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { trackerService } from "@/server/services/tracker-service";

const schema = z.object({
  campaignId: z.string().optional().nullable(),
  name: z.string().min(2).max(120),
  unit: z.string().max(40).optional().nullable(),
  targetValue: z.number().optional().nullable(),
});

export async function GET() {
  try {
    return ok(await trackerService.listTrackers());
  } catch {
    return errorResponse(401, "Unauthorized");
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    return ok(await trackerService.createTracker(payload), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid tracker payload.");
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    if (error instanceof Error) {
      return errorResponse(400, error.message);
    }
    return errorResponse(500, "Failed to create tracker.");
  }
}
