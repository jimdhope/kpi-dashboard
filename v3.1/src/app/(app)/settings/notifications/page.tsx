'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { usePushSubscription } from '@/hooks/use-notification-sse';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Bell, BellOff, Smartphone, Mail, Clock, Zap, Inbox } from 'lucide-react';

interface NotificationPreferences {
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

const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Shanghai', label: 'Shanghai' },
  { value: 'Australia/Sydney', label: 'Sydney' },
];

export default function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const { toast } = useToast();

  // Push subscription
  const {
    isSubscribed,
    isLoading: isPushLoading,
    isSupported: isPushSupported,
    subscribe,
    unsubscribe,
  } = usePushSubscription();

  // Fetch preferences
  useEffect(() => {
    async function fetchPreferences() {
      try {
        const res = await fetch('/api/notifications/preferences');
        if (res.ok) {
          const data = await res.json();
          setPreferences(data.preferences);
        }
      } catch (error) {
        console.error('Error fetching preferences:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPreferences();
  }, []);

  // Save preferences
  const savePreferences = async (updates: Partial<NotificationPreferences>) => {
    if (!preferences) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const data = await res.json();
        setPreferences(data.preferences);
        toast({ title: 'Preferences saved' });
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({ title: 'Error saving preferences', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Send test notification
  const sendTestNotification = async () => {
    setIsSendingTest(true);
    try {
      const res = await fetch('/api/notifications/test-push', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        const results = data.results;
        const sentChannels = [];
        if (results.inApp) sentChannels.push('in-app');
        if (results.push) sentChannels.push('push');

        toast({
          title: 'Test notification sent',
          description: sentChannels.length > 0
            ? `Sent via ${sentChannels.join(' and ')}`
            : 'No channels enabled',
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error sending test:', error);
      toast({ title: 'Error sending test', variant: 'destructive' });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Toggle push subscription
  const handlePushToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
      setPreferences((prev) => prev ? { ...prev, pushSubscribed: false } : null);
    } else {
      await subscribe();
      setPreferences((prev) => prev ? { ...prev, pushSubscribed: true } : null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48 w-full max-w-2xl" />
          <Skeleton className="h-48 w-full max-w-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Notification Settings</h1>
        <p className="text-muted-foreground">Manage how you receive notifications</p>
      </div>

      {/* Channels */}
      <Card variant="glass" className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Channels
          </CardTitle>
          <CardDescription>
            Choose how you want to be notified
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* In-App */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Inbox className="h-5 w-5 text-primary" />
              </div>
              <div>
                <Label htmlFor="inApp" className="font-medium">In-App Notifications</Label>
                <p className="text-sm text-muted-foreground">Show notifications in the app</p>
              </div>
            </div>
            <Switch
              id="inApp"
              checked={preferences?.inAppEnabled ?? true}
              onCheckedChange={(checked) => savePreferences({ inAppEnabled: checked })}
              disabled={isSaving}
            />
          </div>

          {/* Push */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <Label htmlFor="push" className="font-medium">Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  {isPushSupported
                    ? 'Receive notifications even when the app is closed'
                    : 'Not supported in this browser'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isPushLoading && (
                <Switch
                  id="push"
                  checked={isSubscribed}
                  onCheckedChange={handlePushToggle}
                  disabled={isSaving || isPushLoading || !preferences?.pushEnabled}
                />
              )}
              {isPushLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
          </div>

          {/* Email */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <Label htmlFor="email" className="font-medium">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive notifications via email</p>
              </div>
            </div>
            <Switch
              id="email"
              checked={preferences?.emailEnabled ?? true}
              onCheckedChange={(checked) => savePreferences({ emailEnabled: checked })}
              disabled={isSaving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card variant="glass" className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Notification Categories
          </CardTitle>
          <CardDescription>
            Choose which types of notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Competitions */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="competitions" className="font-medium">🏆 Competitions</Label>
              <p className="text-sm text-muted-foreground">Score updates, reminders, and results</p>
            </div>
            <Switch
              id="competitions"
              checked={preferences?.notifyCompetitions ?? true}
              onCheckedChange={(checked) => savePreferences({ notifyCompetitions: checked })}
              disabled={isSaving}
            />
          </div>

          {/* Trackers */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="trackers" className="font-medium">📊 Trackers</Label>
              <p className="text-sm text-muted-foreground">Daily tracking reminders and achievements</p>
            </div>
            <Switch
              id="trackers"
              checked={preferences?.notifyTrackers ?? true}
              onCheckedChange={(checked) => savePreferences({ notifyTrackers: checked })}
              disabled={isSaving}
            />
          </div>

          {/* Achievements */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="achievements" className="font-medium">⭐ Achievements</Label>
              <p className="text-sm text-muted-foreground">Milestones and accomplishments</p>
            </div>
            <Switch
              id="achievements"
              checked={preferences?.notifyAchievements ?? true}
              onCheckedChange={(checked) => savePreferences({ notifyAchievements: checked })}
              disabled={isSaving}
            />
          </div>

          {/* System */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="system" className="font-medium">🔔 System Alerts</Label>
              <p className="text-sm text-muted-foreground">Important system and security notices</p>
            </div>
            <Switch
              id="system"
              checked={preferences?.notifySystem ?? true}
              onCheckedChange={(checked) => savePreferences({ notifySystem: checked })}
              disabled={isSaving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card variant="glass" className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Quiet Hours
          </CardTitle>
          <CardDescription>
            Set a time window when notifications will be paused
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="quietEnabled" className="font-medium">Enable Quiet Hours</Label>
              <p className="text-sm text-muted-foreground">Pause notifications during set hours</p>
            </div>
            <Switch
              id="quietEnabled"
              checked={preferences?.quietHoursEnabled ?? false}
              onCheckedChange={(checked) => savePreferences({ quietHoursEnabled: checked })}
              disabled={isSaving}
            />
          </div>

          {preferences?.quietHoursEnabled && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="quietStart">Start Time</Label>
                <Input
                  id="quietStart"
                  type="time"
                  value={preferences?.quietHoursStart ?? '22:00'}
                  onChange={(e) => savePreferences({ quietHoursStart: e.target.value })}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quietEnd">End Time</Label>
                <Input
                  id="quietEnd"
                  type="time"
                  value={preferences?.quietHoursEnd ?? '08:00'}
                  onChange={(e) => savePreferences({ quietHoursEnd: e.target.value })}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <select
                  id="timezone"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={preferences?.quietHoursTimezone ?? 'UTC'}
                  onChange={(e) => savePreferences({ quietHoursTimezone: e.target.value })}
                  disabled={isSaving}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test */}
      <Card variant="glass" className="max-w-2xl">
        <CardContent className="pt-6">
          <Button
            onClick={sendTestNotification}
            disabled={isSendingTest}
            className="w-full"
          >
            {isSendingTest ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Send Test Notification
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {isSaving && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-primary-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Saving...</span>
        </div>
      )}
    </div>
  );
}
