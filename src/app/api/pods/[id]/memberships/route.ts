import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { podService } from "@/server/services/pod-service";

const schema = z.object({
  userIds: z.array(z.string()).default([]),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = schema.parse(await request.json());
    return ok(await podService.updateMemberships(id, payload.userIds));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid memberships payload.");
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    if (error instanceof Error) {
      return errorResponse(400, error.message);
    }
    return errorResponse(500, "Failed to update pod memberships.");
  }
}
