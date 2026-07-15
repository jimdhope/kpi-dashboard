import { errorResponse, ok } from "@/server/http";
import { teamsAutomationService } from "@/server/services/teams-automation-service";
import { scoreTargetService } from "@/server/services/score-target-service";
import { consumeRateLimit, privateRateLimitKey, requestClientKey } from "@/server/security/rate-limit";

function pickHeaders(headers: Headers) {
  return Object.fromEntries(
    Array.from(headers.entries()).filter(([key]) => key.startsWith("content-") || key.startsWith("x-")),
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ endpointId: string }> }) {
  try {
    const { endpointId } = await params;
    const rate = consumeRateLimit(
      `teams-incoming:${requestClientKey(request)}:${privateRateLimitKey(endpointId)}`,
      { limit: 120, windowMs: 60 * 1000 },
    );
    if (!rate.allowed) return errorResponse(429, "Too many requests.");
    const declaredSize = Number(request.headers.get("content-length") || 0);
    if (declaredSize > 1024 * 1024) return errorResponse(413, "Payload too large.");
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody) > 1024 * 1024) return errorResponse(413, "Payload too large.");
    const payload = (() => { try { return JSON.parse(rawBody); } catch { return null; } })();
    if (payload === null) {
      return errorResponse(400, "Invalid JSON payload.");
    }

    const event = await teamsAutomationService.handleIncomingWebhook({
      endpointId,
      payload,
      headers: pickHeaders(request.headers),
    });

    const scoreResult = await scoreTargetService.processWebhookMessage(payload, endpointId);

    return ok({ 
      received: true, 
      eventId: event.id,
      scoresProcessed: scoreResult.processed,
      scoreResults: scoreResult.results,
    }, { status: 202 });
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
