import { z } from "zod";
import { TEAMS_WEBHOOK_DIRECTIONS } from "@/lib/contracts";
import { errorResponse, ok } from "@/server/http";
import { teamsWebhookService } from "@/server/services/teams-webhook-service";

const schema = z.object({
  name: z.string().min(2).max(120),
  direction: z.enum(TEAMS_WEBHOOK_DIRECTIONS),
  url: z.string().url(),
  description: z.string().max(2000).optional().nullable(),
  isActive: z.boolean(),
});

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const payload = schema.parse(await request.json());
    return ok(await teamsWebhookService.updateWebhook(context.params.id, payload));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid Teams webhook payload.");
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    if (error instanceof Error) {
      return errorResponse(400, error.message);
    }
    return errorResponse(500, "Failed to update Teams webhook.");
  }
}
