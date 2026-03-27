import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/server/auth/session-cookie';
import { hasRole } from '@/server/services/auth-service';
import {
  getPushSettings,
  setPushEnabled,
  generateVapidKeys,
  saveVapidKeys,
  initializeVapidDetails,
} from '@/server/services/push-service';

/**
 * GET /api/settings/push
 * Get push notification settings (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user has admin role
    const isAdmin = await hasRole(user.id, 'admin');
    
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const settings = await getPushSettings();
    
    // Don't expose the private key
    return NextResponse.json({
      enabled: settings.enabled,
      publicKey: settings.publicKey,
      subscriberCount: settings.subscriberCount,
      hasKeys: !!settings.publicKey,
    });
  } catch (error) {
    console.error('Error getting push settings:', error);
    return NextResponse.json(
      { error: 'Failed to get settings' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings/push
 * Update push notification settings (admin only)
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user has admin role
    const isAdmin = await hasRole(user.id, 'admin');
    
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const body = await request.json();
    
    // Handle enabling/disabling
    if (typeof body.enabled === 'boolean') {
      await setPushEnabled(body.enabled);
    }
    
    // Handle generating new keys
    if (body.generateKeys === true) {
      const keys = generateVapidKeys();
      await saveVapidKeys(keys.publicKey, keys.privateKey);
      
      // Re-initialize VAPID details
      await initializeVapidDetails();
      
      return NextResponse.json({
        success: true,
        message: 'New VAPID keys generated',
        publicKey: keys.publicKey,
        // Don't return private key - it should be stored securely
        hasKeys: true,
      });
    }
    
    // Get updated settings
    const settings = await getPushSettings();
    
    return NextResponse.json({
      success: true,
      enabled: settings.enabled,
      publicKey: settings.publicKey,
      subscriberCount: settings.subscriberCount,
      hasKeys: !!settings.publicKey,
    });
  } catch (error) {
    console.error('Error updating push settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
