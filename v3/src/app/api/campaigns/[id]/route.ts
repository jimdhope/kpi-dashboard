import { z } from "zod";
import { campaignService } from "@/server/services/campaign-service";
import { errorResponse, ok } from "@/server/http";

const schema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional().nullable(),
  isActive: z.boolean(),
  incomingWebhookId: z.string().optional().nullable(),
  outgoingWebhookId: z.string().optional().nullable(),
});

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const payload = schema.parse(await request.json());
    return ok(await campaignService.updateCampaign(context.params.id, payload));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid campaign payload.");
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    if (error instanceof Error) {
      return errorResponse(400, error.message);
    }
    return errorResponse(500, "Failed to update campaign.");
  }
}
