import { prisma } from '@/server/db';
import { NotificationType } from '@prisma/client';

/**
 * Notification preferences for a user
 */
export interface UserNotificationPreferences {
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  notifyCompetitions: boolean;
  notifyTrackers: boolean;
  notifyAchievements: boolean;
  notifySystem: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  quietHoursTimezone: string;
  pushSubscribed: boolean;
}

/**
 * Default notification preferences for new users
 */
const DEFAULT_PREFERENCES: UserNotificationPreferences = {
  emailEnabled: true,
  pushEnabled: true,
  inAppEnabled: true,
  notifyCompetitions: true,
  notifyTrackers: true,
  notifyAchievements: true,
  notifySystem: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  quietHoursTimezone: 'UTC',
  pushSubscribed: false,
};

/**
 * Get notification preferences for a user
 */
export async function getUserNotificationPreferences(
  userId: string
): Promise<UserNotificationPreferences> {
  const settings = await prisma.userNotificationSettings.findUnique({
    where: { userId },
  });

  if (!settings) {
    return {
      ...DEFAULT_PREFERENCES,
      pushSubscribed: false,
    };
  }

  return {
    emailEnabled: settings.emailEnabled,
    pushEnabled: settings.pushEnabled,
    inAppEnabled: settings.inAppEnabled,
    notifyCompetitions: settings.notifyCompetitions,
    notifyTrackers: settings.notifyTrackers,
    notifyAchievements: settings.notifyAchievements,
    notifySystem: settings.notifySystem,
    quietHoursEnabled: settings.quietHoursEnabled,
    quietHoursStart: settings.quietHoursStart,
    quietHoursEnd: settings.quietHoursEnd,
    quietHoursTimezone: settings.quietHoursTimezone,
    pushSubscribed: !!settings.pushEndpoint,
  };
}

/**
 * Update notification preferences for a user
 */
export async function updateUserNotificationPreferences(
  userId: string,
  updates: Partial<UserNotificationPreferences>
): Promise<UserNotificationPreferences> {
  // Extract fields that match the schema
  const {
    emailEnabled,
    pushEnabled,
    inAppEnabled,
    notifyCompetitions,
    notifyTrackers,
    notifyAchievements,
    notifySystem,
    quietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
    quietHoursTimezone,
  } = updates;

  const settings = await prisma.userNotificationSettings.upsert({
    where: { userId },
    update: {
      ...(emailEnabled !== undefined && { emailEnabled }),
      ...(pushEnabled !== undefined && { pushEnabled }),
      ...(inAppEnabled !== undefined && { inAppEnabled }),
      ...(notifyCompetitions !== undefined && { notifyCompetitions }),
      ...(notifyTrackers !== undefined && { notifyTrackers }),
      ...(notifyAchievements !== undefined && { notifyAchievements }),
      ...(notifySystem !== undefined && { notifySystem }),
      ...(quietHoursEnabled !== undefined && { quietHoursEnabled }),
      ...(quietHoursStart !== undefined && { quietHoursStart }),
      ...(quietHoursEnd !== undefined && { quietHoursEnd }),
      ...(quietHoursTimezone !== undefined && { quietHoursTimezone }),
    },
    create: {
      userId,
      emailEnabled: emailEnabled ?? DEFAULT_PREFERENCES.emailEnabled,
      pushEnabled: pushEnabled ?? DEFAULT_PREFERENCES.pushEnabled,
      inAppEnabled: inAppEnabled ?? DEFAULT_PREFERENCES.inAppEnabled,
      notifyCompetitions: notifyCompetitions ?? DEFAULT_PREFERENCES.notifyCompetitions,
      notifyTrackers: notifyTrackers ?? DEFAULT_PREFERENCES.notifyTrackers,
      notifyAchievements: notifyAchievements ?? DEFAULT_PREFERENCES.notifyAchievements,
      notifySystem: notifySystem ?? DEFAULT_PREFERENCES.notifySystem,
      quietHoursEnabled: quietHoursEnabled ?? DEFAULT_PREFERENCES.quietHoursEnabled,
      quietHoursStart: quietHoursStart ?? DEFAULT_PREFERENCES.quietHoursStart,
      quietHoursEnd: quietHoursEnd ?? DEFAULT_PREFERENCES.quietHoursEnd,
      quietHoursTimezone: quietHoursTimezone ?? DEFAULT_PREFERENCES.quietHoursTimezone,
    },
  });

  return {
    emailEnabled: settings.emailEnabled,
    pushEnabled: settings.pushEnabled,
    inAppEnabled: settings.inAppEnabled,
    notifyCompetitions: settings.notifyCompetitions,
    notifyTrackers: settings.notifyTrackers,
    notifyAchievements: settings.notifyAchievements,
    notifySystem: settings.notifySystem,
    quietHoursEnabled: settings.quietHoursEnabled,
    quietHoursStart: settings.quietHoursStart,
    quietHoursEnd: settings.quietHoursEnd,
    quietHoursTimezone: settings.quietHoursTimezone,
    pushSubscribed: !!settings.pushEndpoint,
  };
}

/**
 * Check if notifications of a specific type should be sent to a user
 */
export async function shouldSendNotification(
  userId: string,
  notificationType: NotificationType
): Promise<boolean> {
  const settings = await prisma.userNotificationSettings.findUnique({
    where: { userId },
  });

  if (!settings) {
    // Default: send all notifications
    return true;
  }

  // Map notification type to preference field
  const typeToPreference: Record<NotificationType, keyof typeof settings> = {
    competition_reminder: 'notifyCompetitions',
    team_update: 'notifyCompetitions',
    score_achievement: 'notifyAchievements',
    system_alert: 'notifySystem',
  };

  const preferenceField = typeToPreference[notificationType];
  
  if (!preferenceField) {
    return true;
  }

  return (settings[preferenceField] as boolean) ?? true;
}

/**
 * Check if user is in quiet hours
 */
export async function isUserInQuietHours(userId: string): Promise<boolean> {
  const settings = await prisma.userNotificationSettings.findUnique({
    where: { userId },
    select: {
      quietHoursEnabled: true,
      quietHoursStart: true,
      quietHoursEnd: true,
      quietHoursTimezone: true,
    },
  });

  if (!settings?.quietHoursEnabled) {
    return false;
  }

  if (!settings.quietHoursStart || !settings.quietHoursEnd) {
    return false;
  }

  const { quietHoursStart, quietHoursEnd, quietHoursTimezone } = settings;

  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: quietHoursTimezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const currentTime = formatter.format(now);
    const [startHour, startMin] = quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = quietHoursEnd.split(':').map(Number);
    const [currentHour, currentMin] = currentTime.split(':').map(Number);

    const currentMinutes = currentHour * 60 + currentMin;
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    } else {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
  } catch {
    return false;
  }
}

/**
 * Get which channels are enabled for a user
 */
export async function getEnabledChannels(
  userId: string
): Promise<{
  email: boolean;
  push: boolean;
  inApp: boolean;
}> {
  const settings = await prisma.userNotificationSettings.findUnique({
    where: { userId },
  });

  if (!settings) {
    return {
      email: true,
      push: true,
      inApp: true,
    };
  }

  return {
    email: settings.emailEnabled,
    push: settings.pushEnabled && !!settings.pushEndpoint,
    inApp: settings.inAppEnabled,
  };
}

/**
 * Get common timezone options
 */
export const COMMON_TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { value: 'America/Anchorage', label: 'Alaska' },
  { value: 'Pacific/Honolulu', label: 'Hawaii' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Shanghai', label: 'Shanghai' },
  { value: 'Asia/Kolkata', label: 'Mumbai' },
  { value: 'Australia/Sydney', label: 'Sydney' },
  { value: 'Pacific/Auckland', label: 'Auckland' },
] as const;

/**
 * Validate a timezone string
 */
export function isValidTimezone(timezone: string): boolean {
  return COMMON_TIMEZONES.some(tz => tz.value === timezone);
}

/**
 * Format time for display
 */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}
