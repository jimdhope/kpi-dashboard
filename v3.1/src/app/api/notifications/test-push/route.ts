import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/server/auth/session-cookie';
import { getUserNotificationPreferences } from '@/server/services/notification-preferences-service';
import { sendPushToUser, broadcastPushNotification, isUserSubscribed } from '@/server/services/push-service';
import { sendToUser, sendUnreadCount } from '@/server/services/sse-notification-service';
import { prisma } from '@/server/db';

/**
 * POST /api/notifications/test-push
 * Send a test notification to the current user
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const preferences = await getUserNotificationPreferences(user.id);
    
    // Send test via all enabled channels
    const results = {
      inApp: false,
      push: false,
      email: false,
    };
    
    const testNotification = {
      title: 'Test Notification',
      body: 'This is a test notification from KPI Quest. If you see this, your notification settings are working correctly!',
      icon: '/icons/icon-192x192.png',
      tag: 'test-notification',
    };
    
    // Send in-app notification
    if (preferences.inAppEnabled) {
      try {
        // Create a test notification in the database
        await prisma.notification.create({
          data: {
            userId: user.id,
            type: 'system_alert',
            title: testNotification.title,
            message: testNotification.body,
            priority: 'low',
          },
        });
        
        // Send via SSE
        sendToUser(user.id, {
          type: 'notification',
          data: {
            id: 'test',
            title: testNotification.title,
            message: testNotification.body,
            priority: 'low',
            type: 'system_alert',
            createdAt: new Date().toISOString(),
          },
        });
        
        // Update unread count
        await sendUnreadCount(user.id);
        
        results.inApp = true;
      } catch (error) {
        console.error('Error sending in-app test notification:', error);
      }
    }
    
    // Send push notification
    if (preferences.pushEnabled && preferences.pushSubscribed) {
      try {
        const sent = await sendPushToUser(user.id, {
          title: testNotification.title,
          body: testNotification.body,
          icon: testNotification.icon,
          tag: testNotification.tag,
        });
        results.push = sent;
      } catch (error) {
        console.error('Error sending push test notification:', error);
      }
    }
    
    // Note: Email requires SMTP configuration which will be in a later phase
    
    return NextResponse.json({
      success: true,
      message: 'Test notification sent',
      results,
      channels: {
        inApp: preferences.inAppEnabled,
        push: preferences.pushEnabled && preferences.pushSubscribed,
        email: preferences.emailEnabled,
      },
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    return NextResponse.json(
      { error: 'Failed to send test notification' },
      { status: 500 }
    );
  }
}
