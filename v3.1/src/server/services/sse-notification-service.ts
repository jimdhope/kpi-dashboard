/**
 * Server-Sent Events (SSE) Notification Service
 * 
 * Manages real-time notification delivery to connected clients
 * via Server-Sent Events.
 */

import { prisma } from '@/server/db';

// Type for SSE controller
type SSEController = ReadableStreamDefaultController<Uint8Array>;

// Store active SSE connections
const connections = new Map<string, SSEController>();

// Store user IDs by controller (for cleanup)
const controllerToUserId = new WeakMap<SSEController, string>();

/**
 * Add a user connection for SSE notifications
 */
export function addConnection(userId: string, controller: SSEController): void {
  // Close existing connection for this user if any
  removeConnection(userId);
  
  connections.set(userId, controller);
  controllerToUserId.set(controller, userId);
  
  console.log(`[SSE] User ${userId} connected. Active connections: ${connections.size}`);
}

/**
 * Remove a user connection
 */
export function removeConnection(userId: string): void {
  const controller = connections.get(userId);
  
  if (controller) {
    try {
      controller.close();
    } catch {
      // Controller might already be closed
    }
    connections.delete(userId);
    console.log(`[SSE] User ${userId} disconnected. Active connections: ${connections.size}`);
  }
}

/**
 * Remove connection by controller
 */
export function removeConnectionByController(controller: SSEController): void {
  const userId = controllerToUserId.get(controller);
  
  if (userId) {
    connections.delete(userId);
    console.log(`[SSE] User ${userId} disconnected (by controller). Active connections: ${connections.size}`);
  }
}

/**
 * Check if a user has an active connection
 */
export function hasConnection(userId: string): boolean {
  return connections.has(userId);
}

/**
 * Get the number of active connections
 */
export function getConnectionCount(): number {
  return connections.size;
}

/**
 * Send a notification to a specific user
 */
export function sendToUser(
  userId: string,
  event: {
    type: 'notification' | 'unread_count' | 'connection' | 'error';
    data?: unknown;
  }
): boolean {
  const controller = connections.get(userId);
  
  if (!controller) {
    return false;
  }
  
  try {
    const message = formatSSEMessage(event);
    controller.enqueue(new TextEncoder().encode(message));
    return true;
  } catch (error) {
    console.error(`[SSE] Failed to send to user ${userId}:`, error);
    removeConnection(userId);
    return false;
  }
}

/**
 * Broadcast a notification to all connected users
 */
export function broadcast(
  event: {
    type: 'notification' | 'unread_count' | 'connection' | 'error';
    data?: unknown;
  }
): void {
  const message = formatSSEMessage(event);
  const encoded = new TextEncoder().encode(message);
  
  for (const [userId, controller] of connections) {
    try {
      controller.enqueue(encoded);
    } catch (error) {
      console.error(`[SSE] Failed to broadcast to user ${userId}:`, error);
      removeConnection(userId);
    }
  }
}

/**
 * Broadcast to users with specific notification preferences
 */
export async function broadcastToSubscribers(
  event: {
    type: 'notification' | 'unread_count' | 'connection' | 'error';
    data?: unknown;
  },
  options?: {
    notifyCompetitions?: boolean;
    notifyTrackers?: boolean;
    notifyAchievements?: boolean;
    notifySystem?: boolean;
  }
): Promise<void> {
  // If no filter, broadcast to all
  if (!options) {
    broadcast(event);
    return;
  }
  
  // Get users with matching preferences
  const whereClause: Record<string, boolean> = {
    inAppEnabled: true,
  };
  
  if (options.notifyCompetitions) {
    whereClause.notifyCompetitions = true;
  }
  if (options.notifyTrackers) {
    whereClause.notifyTrackers = true;
  }
  if (options.notifyAchievements) {
    whereClause.notifyAchievements = true;
  }
  if (options.notifySystem) {
    whereClause.notifySystem = true;
  }
  
  const subscribers = await prisma.userNotificationSettings.findMany({
    where: whereClause,
    select: { userId: true },
  });
  
  const subscriberIds = new Set(subscribers.map(s => s.userId));
  
  const message = formatSSEMessage(event);
  const encoded = new TextEncoder().encode(message);
  
  for (const userId of subscriberIds) {
    const controller = connections.get(userId);
    if (controller) {
      try {
        controller.enqueue(encoded);
      } catch (error) {
        console.error(`[SSE] Failed to send to subscriber ${userId}:`, error);
        removeConnection(userId);
      }
    }
  }
}

/**
 * Send unread count to a user
 */
export async function sendUnreadCount(userId: string): Promise<void> {
  const unreadCount = await prisma.notification.count({
    where: {
      userId,
      readAt: null,
    },
  });
  
  sendToUser(userId, {
    type: 'unread_count',
    data: { count: unreadCount },
  });
}

/**
 * Format an SSE message
 */
function formatSSEMessage(event: {
  type: 'notification' | 'unread_count' | 'connection' | 'error';
  data?: unknown;
}): string {
  const id = Date.now();
  const eventType = event.type;
  const messageData = JSON.stringify({
    ...event.data,
    type: eventType,
    timestamp: new Date().toISOString(),
  });
  
  return `id: ${id}\nevent: ${eventType}\ndata: ${messageData}\n\n`;
}

/**
 * Create a keep-alive interval for SSE connections
 * Call this when setting up SSE endpoint
 */
export function createKeepAlive(controller: SSEController, intervalMs: number = 30000): () => void {
  const interval = setInterval(() => {
    try {
      controller.enqueue(new TextEncoder().encode(': keepalive\n\n'));
    } catch {
      clearInterval(interval);
    }
  }, intervalMs);
  
  return () => clearInterval(interval);
}

/**
 * Clean up stale connections
 */
export function cleanupStaleConnections(): void {
  for (const [userId, controller] of connections) {
    try {
      // Check if controller is still writable
      controller.enqueue(new TextEncoder().encode(''));
    } catch {
      // Controller is stale, remove it
      connections.delete(userId);
      console.log(`[SSE] Cleaned up stale connection for user ${userId}`);
    }
  }
}
