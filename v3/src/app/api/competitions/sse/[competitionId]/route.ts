import { NextRequest } from "next/server";
import { authService } from "@/server/services/auth-service";
import { competitionSseService } from "@/server/services/competition-sse-service";

export async function GET(
  request: NextRequest,
  { params }: { params: { competitionId: string } }
) {
  try {
    // Verify user is authenticated
    const session = await authService.getCurrentSession();
    if (!session.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const competitionId = params.competitionId;
    const clientId = session.user.id;

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection message
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', message: 'Connected to competition updates' })}\n\n`));

        // Subscribe this client
        competitionSseService.subscribe(competitionId, clientId, {
          write: (data: string) => {
            try {
              controller.enqueue(encoder.encode(data));
            } catch (error) {
              console.error('Error writing SSE:', error);
            }
          },
        });

        // Send heartbeat every 30 seconds to keep connection alive
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: heartbeat\n\n`));
          } catch (error) {
            clearInterval(heartbeat);
          }
        }, 30000);

        // Handle close
        request.signal.addEventListener("abort", () => {
          clearInterval(heartbeat);
          competitionSseService.unsubscribe(competitionId, clientId);
          try {
            controller.close();
          } catch (error) {
            // Already closed
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
  } catch (error) {
    console.error('SSE error:', error);
    return new Response("Unauthorized", { status: 401 });
  }
}
