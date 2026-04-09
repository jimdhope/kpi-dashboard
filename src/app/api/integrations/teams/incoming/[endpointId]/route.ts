import { errorResponse, ok } from "@/server/http";
import { teamsAutomationService } from "@/server/services/teams-automation-service";

function pickHeaders(headers: Headers) {
  return Object.fromEntries(
    Array.from(headers.entries()).filter(([key]) => key.startsWith("content-") || key.startsWith("x-")),
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ endpointId: string }> }) {
  try {
    const { endpointId } = await params;
    const payload = await request.json().catch(() => null);
    if (payload === null) {
      return errorResponse(400, "Invalid JSON payload.");
    }

    const event = await teamsAutomationService.handleIncomingWebhook({
      endpointId,
      payload,
      headers: pickHeaders(request.headers),
    });

    return ok({ received: true, eventId: event.id }, { status: 202 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Incoming Teams webhook endpoint not found.") {
        return errorResponse(404, error.message);
      }
      return errorResponse(400, error.message);
    }
    return errorResponse(500, "Failed to process incoming Teams webhook.");
  }
}
