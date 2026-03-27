import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/server/auth/session-cookie';
import { unsubscribeUser } from '@/server/services/push-service';

/**
 * DELETE /api/notifications/unsubscribe
 * Unsubscribe user from push notifications
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    await unsubscribeUser(user.id);
    
    return NextResponse.json({
      success: true,
      message: 'Unsubscribed from push notifications',
    });
  } catch (error) {
    console.error('Error unsubscribing from push:', error);
    return NextResponse.json(
      { error: 'Failed to unsubscribe' },
      { status: 500 }
    );
  }
}
