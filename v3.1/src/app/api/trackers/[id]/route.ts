import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { trackerService } from "@/server/services/tracker-service";

const schema = z.object({
  campaignId: z.string().optional().nullable(),
  name: z.string().min(2).max(120),
  unit: z.string().max(40).optional().nullable(),
  targetValue: z.number().optional().nullable(),
});

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const payload = schema.parse(await request.json());
    return ok(await trackerService.updateTracker(context.params.id, payload));
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
    return errorResponse(500, "Failed to update tracker.");
  }
}

export async function DELETE(request: Request, context: { params: { id: string } }) {
  try {
    await trackerService.deleteTracker(context.params.id);
    return ok({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    if (error instanceof Error) {
      return errorResponse(400, error.message);
    }
    return errorResponse(500, "Failed to delete tracker.");
  }
}
