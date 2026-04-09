import { z } from "zod";
import { podService } from "@/server/services/pod-service";
import { errorResponse, ok } from "@/server/http";

const schema = z.object({
  campaignId: z.string().optional().nullable(),
  incomingWebhookId: z.string().optional().nullable(),
  outgoingWebhookId: z.string().optional().nullable(),
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional().nullable(),
});

export async function GET() {
  try {
    const pods = await podService.listPods();
    return ok({ pods });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    return errorResponse(401, "Unauthorized");
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    return ok(await podService.createPod(payload), { status: 201 });
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
    return errorResponse(500, "Failed to create pod.");
  }
}
