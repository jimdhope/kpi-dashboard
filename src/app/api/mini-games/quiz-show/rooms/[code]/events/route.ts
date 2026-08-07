import { authService } from "@/server/services/auth-service";
import { quizShowService, quizShowSseService } from "@/server/services/quiz-show-service";

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const user = await authService.requireCurrentUser();
    const { code } = await context.params;
    const normalizedCode = code.toUpperCase();
    await quizShowService.getRoomState(user.id, normalizedCode);
    const stream = new ReadableStream({ start(controller) { const encoder = new TextEncoder(); const send = (event: string, data: string) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`)); const unsubscribe = quizShowSseService.subscribe(normalizedCode, send); send("connected", JSON.stringify({ ok: true })); const heartbeat = setInterval(() => { try { controller.enqueue(encoder.encode(": heartbeat\n\n")); } catch { clearInterval(heartbeat); } }, 30_000); request.signal.addEventListener("abort", () => { clearInterval(heartbeat); unsubscribe(); try { controller.close(); } catch {} }); } });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
  } catch { return new Response("Unauthorized", { status: 401 }); }
}
