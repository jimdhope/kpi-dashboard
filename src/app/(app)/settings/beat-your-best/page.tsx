'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface BybSettings {
  enabled: boolean;
  teamsAnnouncementEnabled: boolean;
}

export default function BeatYourBestSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<BybSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings/beat-your-best')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Failed to load'))))
      .then((data: BybSettings) => setSettings(data))
      .catch(() => toast({ variant: 'destructive', title: 'Could not load settings' }));
  }, [toast]);

  const update = async (patch: Partial<BybSettings>) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/settings/beat-your-best', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error('Failed to save');
      const data: BybSettings = await response.json();
      setSettings(data);
      toast({ title: 'Settings saved' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          Beat Your Best
          <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 border border-amber-500/40">
            BETA
          </Badge>
        </h1>
        <p className="text-muted-foreground">
          Weekly scoring measured against each player&apos;s own recent form.
        </p>
      </div>

      {!settings ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Leaderboard</CardTitle>
              <CardDescription>
                Shows the &ldquo;Beat Your Best&rdquo; standings page and the dashboard card for everyone.
                Weekly score is measured against each player&apos;s own recent form instead of raw totals.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Enable Beat Your Best</p>
                <p className="text-xs text-muted-foreground">Off by default — the app behaves exactly as before.</p>
              </div>
              <Switch
                checked={settings.enabled}
                disabled={isSaving}
                onCheckedChange={(checked) => void update({ enabled: checked })}
                aria-label="Enable Beat Your Best"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Teams announcement</CardTitle>
              <CardDescription>
                Post the weekly winner to Microsoft Teams at the end of each week using the existing
                webhook automation. Never fires while this is off.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Announce in Teams</p>
                <p className="text-xs text-muted-foreground">Requires Beat Your Best to be enabled.</p>
              </div>
              <Switch
                checked={settings.teamsAnnouncementEnabled}
                disabled={isSaving || !settings.enabled}
                onCheckedChange={(checked) => void update({ teamsAnnouncementEnabled: checked })}
                aria-label="Enable Teams announcement"
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
