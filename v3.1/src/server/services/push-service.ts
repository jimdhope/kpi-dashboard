import * as webpush from 'web-push';
import type { PushSubscription } from 'web-push';
import { prisma } from '@/server/db';
import { encrypt, decrypt } from '@/server/auth/encryption';

// VAPID details - will be loaded from database
let vapidDetails: { publicKey: string; privateKey: string; subject: string } | null = null;

/**
 * Initialize VAPID details from database settings
 */
export async function initializeVapidDetails(): Promise<void> {
  const pushSettings = await prisma.appPushSettings.findUnique({
    where: { id: 'push' },
  });

  if (pushSettings?.vapidPublicKey && pushSettings?.vapidPrivateKey) {
    // Decrypt the private key if stored encrypted
    let privateKey = pushSettings.vapidPrivateKey;
    if (privateKey.startsWith('enc:')) {
      privateKey = decrypt(privateKey.substring(4));
    }

    vapidDetails = {
      publicKey: pushSettings.vapidPublicKey,
      privateKey,
      subject: pushSettings.vapidPublicKey,
    };

    webpush.setVapidDetails(
      `mailto:${pushSettings.vapidPublicKey}`,
      pushSettings.vapidPublicKey,
      privateKey
    );
  }
}

/**
 * Generate new VAPID keys
 */
export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  const keys = webpush.generateVAPIDKeys();
  return {
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
  };
}

/**
 * Save VAPID keys to database (encrypted)
 */
export async function saveVapidKeys(publicKey: string, privateKey: string): Promise<void> {
  const encryptedPrivateKey = `enc:${encrypt(privateKey)}`;

  await prisma.appPushSettings.upsert({
    where: { id: 'push' },
    update: {
      vapidPublicKey: publicKey,
      vapidPrivateKey: encryptedPrivateKey,
    },
    create: {
      id: 'push',
      vapidPublicKey: publicKey,
      vapidPrivateKey: encryptedPrivateKey,
      enabled: false,
    },
  });

  // Reinitialize VAPID details
  await initializeVapidDetails();
}

/**
 * Get push settings from database
 */
export async function getPushSettings(): Promise<{
  enabled: boolean;
  publicKey: string | null;
  subscriberCount: number;
}> {
  const pushSettings = await prisma.appPushSettings.findUnique({
    where: { id: 'push' },
  });

  const subscriberCount = await prisma.userNotificationSettings.count({
    where: {
      pushEnabled: true,
      pushEndpoint: { not: null },
    },
  });

  return {
    enabled: pushSettings?.enabled ?? false,
    publicKey: pushSettings?.vapidPublicKey ?? null,
    subscriberCount,
  };
}

/**
 * Enable or disable push notifications
 */
export async function setPushEnabled(enabled: boolean): Promise<void> {
  await prisma.appPushSettings.upsert({
    where: { id: 'push' },
    update: { enabled },
    create: {
      id: 'push',
      enabled,
      vapidPublicKey: null,
      vapidPrivateKey: null,
    },
  });
}

/**
 * Subscribe a user to push notifications
 */
export async function subscribeUser(
  userId: string,
  subscription: PushSubscription
): Promise<void> {
  const encryptedSubscription = encrypt(JSON.stringify(subscription));

  await prisma.userNotificationSettings.upsert({
    where: { userId },
    update: {
      pushSubscription: encryptedSubscription,
      pushEndpoint: subscription.endpoint,
      pushEnabled: true,
    },
    create: {
      userId,
      pushSubscription: encryptedSubscription,
      pushEndpoint: subscription.endpoint,
      pushEnabled: true,
      emailEnabled: true,
      inAppEnabled: true,
      notifyCompetitions: true,
      notifyTrackers: true,
      notifyAchievements: true,
      notifySystem: true,
      quietHoursEnabled: false,
      quietHoursTimezone: 'UTC',
    },
  });
}

/**
 * Unsubscribe a user from push notifications
 */
export async function unsubscribeUser(userId: string): Promise<void> {
  await prisma.userNotificationSettings.update({
    where: { userId },
    data: {
      pushSubscription: null,
      pushEndpoint: null,
    },
  });
}

/**
 * Check if push is enabled globally and user is subscribed
 */
export async function isUserSubscribed(userId: string): Promise<boolean> {
  const pushSettings = await prisma.appPushSettings.findUnique({
    where: { id: 'push' },
  });

  if (!pushSettings?.enabled) {
    return false;
  }

  const userSettings = await prisma.userNotificationSettings.findUnique({
    where: { userId },
  });

  return !!(userSettings?.pushEndpoint && userSettings?.pushEnabled);
}

/**
 * Send a push notification to a specific user
 */
export async function sendPushToUser(
  userId: string,
  notification: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: Record<string, unknown>;
  }
): Promise<boolean> {
  if (!vapidDetails) {
    await initializeVapidDetails();
    if (!vapidDetails) {
      console.error('Push notifications not configured - VAPID keys not set');
      return false;
    }
  }

  const userSettings = await prisma.userNotificationSettings.findUnique({
    where: { userId },
  });

  if (!userSettings?.pushEnabled || !userSettings?.pushSubscription) {
    return false;
  }

  // Check quiet hours
  if (userSettings.quietHoursEnabled) {
    if (isInQuietHours(userSettings.quietHoursStart, userSettings.quietHoursEnd, userSettings.quietHoursTimezone)) {
      return false; // Skip during quiet hours
    }
  }

  try {
    const subscription = JSON.parse(
      decrypt(userSettings.pushSubscription)
    ) as PushSubscription;

    await webpush.sendNotification(subscription, JSON.stringify(notification));
    return true;
  } catch (error: any) {
    // Handle expired or invalid subscriptions
    if (error.statusCode === 404 || error.statusCode === 410) {
      // Subscription expired or no longer valid - clean up
      await unsubscribeUser(userId);
      console.log(`Push subscription expired for user ${userId}`);
    } else {
      console.error(`Failed to send push to user ${userId}:`, error);
    }
    return false;
  }
}

/**
 * Send a push notification to all subscribed users
 */
export async function broadcastPushNotification(
  notification: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: Record<string, unknown>;
  },
  filter?: {
    notifyCompetitions?: boolean;
    notifyTrackers?: boolean;
    notifyAchievements?: boolean;
    notifySystem?: boolean;
  }
): Promise<{ sent: number; failed: number }> {
  if (!vapidDetails) {
    await initializeVapidDetails();
    if (!vapidDetails) {
      console.error('Push notifications not configured - VAPID keys not set');
      return { sent: 0, failed: 0 };
    }
  }

  const pushSettings = await prisma.appPushSettings.findUnique({
    where: { id: 'push' },
  });

  if (!pushSettings?.enabled) {
    return { sent: 0, failed: 0 };
  }

  // Build where clause
  const whereClause: Record<string, unknown> = {
    pushEnabled: true,
    pushEndpoint: { not: null },
  };

  // Get all subscribed users
  const subscribers = await prisma.userNotificationSettings.findMany({
    where: whereClause,
    select: {
      userId: true,
      pushSubscription: true,
      quietHoursEnabled: true,
      quietHoursStart: true,
      quietHoursEnd: true,
      quietHoursTimezone: true,
    },
  });

  let sent = 0;
  let failed = 0;

  for (const subscriber of subscribers) {
    if (!subscriber.pushSubscription) continue;

    // Check quiet hours
    if (subscriber.quietHoursEnabled) {
      if (isInQuietHours(subscriber.quietHoursStart, subscriber.quietHoursEnd, subscriber.quietHoursTimezone)) {
        continue;
      }
    }

    try {
      const subscription = JSON.parse(
        decrypt(subscriber.pushSubscription)
      ) as PushSubscription;

      await webpush.sendNotification(subscription, JSON.stringify(notification));
      sent++;
    } catch (error: any) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await unsubscribeUser(subscriber.userId);
      }
      failed++;
      console.error(`Failed to send push to user ${subscriber.userId}:`, error.message);
    }
  }

  return { sent, failed };
}

/**
 * Check if current time is within quiet hours
 */
function isInQuietHours(
  start: string | null,
  end: string | null,
  timezone: string
): boolean {
  if (!start || !end) return false;

  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const currentTime = formatter.format(now);
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    const [currentHour, currentMin] = currentTime.split(':').map(Number);

    const currentMinutes = currentHour * 60 + currentMin;
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startMinutes > endMinutes) {
      // Quiet hours span midnight
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    } else {
      // Quiet hours within same day
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
  } catch {
    return false;
  }
}

/**
 * Get the public VAPID key for client subscription
 */
export function getPublicVapidKey(): string | null {
  return vapidDetails?.publicKey ?? null;
}
