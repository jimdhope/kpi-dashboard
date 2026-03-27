import { z } from "zod";
import { podService } from "@/server/services/pod-service";
import { podRepository } from "@/server/repositories/pod-repository";
import { errorResponse, ok } from "@/server/http";

const schema = z.object({
  campaignId: z.string().optional().nullable(),
  incomingWebhookId: z.string().optional().nullable(),
  outgoingWebhookId: z.string().optional().nullable(),
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional().nullable(),
});

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const payload = schema.parse(await request.json());
    return ok(await podService.updatePod(context.params.id, payload));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid pod payload.");
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    if (error instanceof Error) {
      return errorResponse(400, error.message);
    }
    return errorResponse(500, "Failed to update pod.");
  }
}

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  try {
    await podService.deletePod(context.params.id);
    return ok({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return errorResponse(404, "Pod not found.");
    }
    return errorResponse(500, "Failed to delete pod.");
  }
}
