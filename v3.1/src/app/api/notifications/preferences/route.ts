import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/server/auth/session-cookie';
import { getUserNotificationPreferences, updateUserNotificationPreferences } from '@/server/services/notification-preferences-service';
import { COMMON_TIMEZONES, isValidTimezone } from '@/server/services/notification-preferences-service';

/**
 * GET /api/notifications/preferences
 * Get current user's notification preferences
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const preferences = await getUserNotificationPreferences(user.id);
    
    return NextResponse.json({
      preferences,
      availableTimezones: COMMON_TIMEZONES,
    });
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to get preferences' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications/preferences
 * Update current user's notification preferences
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    
    // Validate timezone if provided
    if (body.quietHoursTimezone && !isValidTimezone(body.quietHoursTimezone)) {
      return NextResponse.json(
        { error: 'Invalid timezone' },
        { status: 400 }
      );
    }
    
    // Validate time format if provided
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (body.quietHoursStart && !timeRegex.test(body.quietHoursStart)) {
      return NextResponse.json(
        { error: 'Invalid start time format. Use HH:MM (24-hour format)' },
        { status: 400 }
      );
    }
    if (body.quietHoursEnd && !timeRegex.test(body.quietHoursEnd)) {
      return NextResponse.json(
        { error: 'Invalid end time format. Use HH:MM (24-hour format)' },
        { status: 400 }
      );
    }
    
    // Update preferences
    const updated = await updateUserNotificationPreferences(user.id, {
      emailEnabled: body.emailEnabled,
      pushEnabled: body.pushEnabled,
      inAppEnabled: body.inAppEnabled,
      notifyCompetitions: body.notifyCompetitions,
      notifyTrackers: body.notifyTrackers,
      notifyAchievements: body.notifyAchievements,
      notifySystem: body.notifySystem,
      quietHoursEnabled: body.quietHoursEnabled,
      quietHoursStart: body.quietHoursStart,
      quietHoursEnd: body.quietHoursEnd,
      quietHoursTimezone: body.quietHoursTimezone,
    });
    
    return NextResponse.json({
      preferences: updated,
      message: 'Preferences updated successfully',
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
