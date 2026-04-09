import { z } from "zod";
import { TEAMS_CHANNEL_CATEGORIES, TEAMS_WEBHOOK_DIRECTIONS } from "@/lib/contracts";
import { errorResponse, ok } from "@/server/http";
import { teamsWebhookService } from "@/server/services/teams-webhook-service";

const schema = z.object({
  name: z.string().min(2).max(120),
  friendlyName: z.string().max(120).optional().nullable(),
  direction: z.enum(TEAMS_WEBHOOK_DIRECTIONS),
  category: z.enum(TEAMS_CHANNEL_CATEGORIES).optional().nullable(),
  url: z.string().url(),
  description: z.string().max(2000).optional().nullable(),
  isActive: z.boolean(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = schema.parse(await request.json());
    return ok(await teamsWebhookService.updateWebhook(id, payload));
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await teamsWebhookService.deleteWebhook(id);
    return ok({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Not found") {
      return errorResponse(404, "Webhook not found");
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    console.error("DELETE /api/integrations/teams-webhooks/[id] error:", error);
    return errorResponse(500, "Failed to delete webhook");
  }
}
