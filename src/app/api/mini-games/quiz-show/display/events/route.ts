import { quizShowService, quizShowSseService } from "@/server/services/quiz-show-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim().toUpperCase();
  const token = url.searchParams.get("token")?.trim();
  if (!code || !token) return new Response("Invalid display link.", { status: 401 });

  try {
    await quizShowService.getPresentationState(code, token);
  } catch {
    return new Response("Invalid display link.", { status: 401 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: string) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      const unsubscribe = quizShowSseService.subscribe(code, send);
      send("connected", JSON.stringify({ ok: true }));
      const heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(": heartbeat\n\n")); } catch { clearInterval(heartbeat); }
      }, 30_000);
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
