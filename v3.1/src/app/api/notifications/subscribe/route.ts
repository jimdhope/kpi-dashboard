import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/server/auth/session-cookie';
import { subscribeUser, getPublicVapidKey, isUserSubscribed } from '@/server/services/push-service';

/**
 * POST /api/notifications/subscribe
 * Subscribe user to push notifications
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get VAPID public key
    const publicKey = getPublicVapidKey();
    
    if (!publicKey) {
      return NextResponse.json(
        { error: 'Push notifications not configured' },
        { status: 503 }
      );
    }
    
    const body = await request.json();
    const { subscription } = body;
    
    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: 'Invalid subscription object' },
        { status: 400 }
      );
    }
    
    await subscribeUser(user.id, subscription);
    
    return NextResponse.json({
      success: true,
      message: 'Subscribed to push notifications',
      publicKey,
    });
  } catch (error) {
    console.error('Error subscribing to push:', error);
    return NextResponse.json(
      { error: 'Failed to subscribe' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/notifications/subscribe
 * Get push subscription status and VAPID public key
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const publicKey = getPublicVapidKey();
    const subscribed = await isUserSubscribed(user.id);
    
    return NextResponse.json({
      publicKey,
      subscribed,
      configured: !!publicKey,
    });
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return NextResponse.json(
      { error: 'Failed to get subscription status' },
      { status: 500 }
    );
  }
}
