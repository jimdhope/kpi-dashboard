import { errorResponse, ok } from "@/server/http";
import { memeMatchService } from "@/server/services/meme-match-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code")?.trim().toUpperCase();
    const token = url.searchParams.get("token")?.trim();
    if (!code || !token) return errorResponse(401, "Invalid display link.");
    return ok(await memeMatchService.getPresentationState(code, token), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load presentation.";
    return errorResponse(message.includes("not found") ? 404 : 401, message);
  }
}
