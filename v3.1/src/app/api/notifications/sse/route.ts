import { NextRequest } from 'next/server';
import { getSessionUser } from '@/server/auth/session-cookie';
import {
  addConnection,
  removeConnection,
  sendUnreadCount,
  createKeepAlive,
} from '@/server/services/sse-notification-service';

/**
 * GET /api/notifications/sse
 * Server-Sent Events stream for real-time notifications
 */
export async function GET(request: NextRequest) {
  // Get authenticated user
  const user = await getSessionUser();
  
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const userId = user.id;
  
  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      // Add connection
      addConnection(userId, controller);
      
      // Send initial unread count
      sendUnreadCount(userId).catch(console.error);
      
      // Send connection event
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(
          `id: ${Date.now()}\nevent: connection\ndata: {"userId":"${userId}","status":"connected"}\n\n`
        )
      );
      
      // Set up keep-alive
      const cleanupKeepAlive = createKeepAlive(controller, 30000);
      
      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        cleanupKeepAlive();
        removeConnection(userId);
      });
    },
    cancel() {
      // Called when stream is cancelled
      removeConnection(userId);
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
