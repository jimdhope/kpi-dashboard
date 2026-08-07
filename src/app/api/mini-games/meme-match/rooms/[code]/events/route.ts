import { authService } from "@/server/services/auth-service";
import { memeMatchService, memeMatchSseService } from "@/server/services/meme-match-service";

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const user = await authService.requireCurrentUser();
    const { code } = await context.params;
    await memeMatchService.getRoomState(user.id, code.toUpperCase());

    const clientId = `${user.id}:${crypto.randomUUID()}`;
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const write = (data: string) => controller.enqueue(encoder.encode(data));
        memeMatchSseService.subscribe(code.toUpperCase(), clientId, write);
        controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`));

        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: heartbeat\n\n`));
          } catch {
            clearInterval(heartbeat);
          }
        }, 30000);

        request.signal.addEventListener("abort", () => {
          clearInterval(heartbeat);
          memeMatchSseService.unsubscribe(code.toUpperCase(), clientId);
          try {
            controller.close();
          } catch {
            // ignore close races
          }
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
}
