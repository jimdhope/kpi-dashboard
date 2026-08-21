import { memeMatchService, memeMatchSseService } from "@/server/services/meme-match-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim().toUpperCase();
  const token = url.searchParams.get("token")?.trim();
  if (!code || !token) return new Response("Invalid display link.", { status: 401 });

  try {
    await memeMatchService.getPresentationState(code, token);
  } catch {
    return new Response("Invalid display link.", { status: 401 });
  }

  const clientId = `display:${crypto.randomUUID()}`;
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const write = (data: string) => controller.enqueue(encoder.encode(data));
      // Player SSE payloads contain viewer-specific data, so the presentation
      // stream only forwards a refresh signal and fetches its sanitized state.
      memeMatchSseService.subscribe(code, clientId, () => write("event: room-state\ndata: {}\n\n"));
      write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);
      const heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(": heartbeat\n\n")); } catch { clearInterval(heartbeat); }
      }, 30_000);
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        memeMatchSseService.unsubscribe(code, clientId);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
