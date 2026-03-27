'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Smartphone, Zap, Key, Users, Bell } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface PushSettings {
  enabled: boolean;
  publicKey: string | null;
  subscriberCount: number;
  hasKeys: boolean;
}

export default function GeneralSettings() {
  const [pushSettings, setPushSettings] = useState<PushSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchSettings() {
      try {
        // Check if user is admin
        const sessionRes = await fetch('/api/auth/session');
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          // For now, assume admin if they can access settings
          // In a real app, check user roles
          setIsAdmin(true);
        }

        // Fetch push settings
        const pushRes = await fetch('/api/settings/push');
        if (pushRes.ok) {
          const data = await pushRes.json();
          setPushSettings(data);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSettings();
  }, []);

  // Toggle push notifications
  const togglePush = async () => {
    if (!pushSettings) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/settings/push', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !pushSettings.enabled }),
      });

      if (res.ok) {
        const data = await res.json();
        setPushSettings(data);
        toast({
          title: pushSettings.enabled ? 'Push disabled' : 'Push enabled',
        });
      } else {
        throw new Error('Failed to update');
      }
    } catch (error) {
      console.error('Error toggling push:', error);
      toast({ title: 'Error updating settings', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Generate new VAPID keys
  const generateKeys = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/settings/push', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generateKeys: true }),
      });

      if (res.ok) {
        const data = await res.json();
        setPushSettings({
          enabled: data.enabled,
          publicKey: data.publicKey,
          subscriberCount: pushSettings?.subscriberCount ?? 0,
          hasKeys: data.hasKeys,
        });
        toast({
          title: 'VAPID keys generated',
          description: 'New public key is ready. Users can now subscribe to push notifications.',
        });
      } else {
        throw new Error('Failed to generate keys');
      }
    } catch (error) {
      console.error('Error generating keys:', error);
      toast({ title: 'Error generating keys', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-64 w-full max-w-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">General Settings</h1>
        <p className="text-muted-foreground">Configure app-wide settings</p>
      </div>

      {/* Push Notifications Settings (Admin Only) */}
      {isAdmin && (
        <Card variant="glass" className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Push Notifications
            </CardTitle>
            <CardDescription>
              Configure browser push notification settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Enable/Disable */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Enable Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Allow users to receive push notifications
                </p>
              </div>
              <Switch
                checked={pushSettings?.enabled ?? false}
                onCheckedChange={togglePush}
                disabled={isSaving || !pushSettings?.hasKeys}
              />
            </div>

            {/* VAPID Keys */}
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                <Label className="font-medium">VAPID Keys</Label>
              </div>

              {pushSettings?.hasKeys ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <span className="h-2 w-2 rounded-full bg-green-600" />
                    VAPID keys are configured
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Public Key</Label>
                    <code className="block max-w-xl truncate rounded bg-muted p-2 text-xs">
                      {pushSettings.publicKey || 'Not available'}
                    </code>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{pushSettings.subscriberCount} active subscribers</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateKeys}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        'Regenerate Keys'
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-yellow-600">
                    <span className="h-2 w-2 rounded-full bg-yellow-600" />
                    VAPID keys not configured
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Generate VAPID keys to enable push notifications for users.
                  </p>
                  <Button onClick={generateKeys} disabled={isGenerating}>
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        Generate VAPID Keys
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center gap-2 text-sm">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Push notifications will use Server-Sent Events (SSE) for real-time in-app updates.
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Non-admin message */}
      {!isAdmin && (
        <Card variant="glass" className="max-w-2xl">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              You need admin privileges to configure these settings.
            </p>
          </CardContent>
        </Card>
      )}

      {isSaving && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-primary-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Saving...</span>
        </div>
      )}
    </div>
  );
}
