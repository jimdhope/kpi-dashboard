'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Smartphone, Zap, Key, Users, Bell, Download, Upload, Trash2, AlertTriangle, CheckCircle, XCircle, ShieldAlert } from 'lucide-react';
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
  // Backup/Restore
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [restorePhase, setRestorePhase] = useState<'idle' | 'confirm' | 'backup' | 'restore' | 'done'>('idle');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [autoBackupPath, setAutoBackupPath] = useState<string | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/settings/backup', {
        method: 'GET', credentials: 'include',
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(err.error || 'Failed to export backup');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `kpi-quest-backup-${new Date().toISOString().split('T')[0]}.sql.gz`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast({ title: 'Backup exported', description: `Downloaded ${filename}` });
    } catch (error) {
      toast({ title: 'Export failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally { setIsExporting(false); }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPendingFileName(file.name);
    setRestoreError(null);
    setAutoBackupPath(null);
    setRestorePhase('confirm');
  };

  const confirmRestore = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setIsRestoring(true);
    setRestorePhase('backup');
    setRestoreError(null);
    setAutoBackupPath(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      setRestorePhase('backup');
      const response = await fetch('/api/settings/backup/restore', {
        method: 'POST', body: formData, credentials: 'include',
      });
      setRestorePhase('restore');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Restore failed');
      setAutoBackupPath(result.autoBackupPath || null);
      setRestorePhase('done');
      toast({ title: 'Backup restored', description: 'Data has been restored successfully' });
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : 'Restore failed');
      setRestorePhase('done');
      toast({ title: 'Restore failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally { setIsRestoring(false); }
  };

  const cancelRestore = () => {
    setRestorePhase('idle');
    setPendingFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClearData = async () => {
    const confirmed = window.confirm('Are you sure you want to clear ALL data? This action cannot be undone!');
    if (!confirmed) return;
    setIsClearing(true);
    try {
      const response = await fetch('/api/settings/backup/clear', {
        method: 'DELETE', credentials: 'include',
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Clear failed' }));
        throw new Error(err.error || 'Failed to clear data');
      }
      toast({ title: 'Data cleared', description: 'All application data has been deleted' });
    } catch (error) {
      toast({ title: 'Clear failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally { setIsClearing(false); }
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

      {/* Backup & Restore (Admin only) */}
      {isAdmin && (
        <Card variant="glass" className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Backup & Restore
            </CardTitle>
            <CardDescription>
              Export a full database SQL dump or restore from a previous backup
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                <h4 className="text-sm font-medium">Export Backup</h4>
                <p className="text-xs text-muted-foreground">
                  Creates a complete SQL dump compressed as a <code>.sql.gz</code> archive.
                </p>
                <Button onClick={handleExport} disabled={isExporting} size="sm" className="w-full">
                  {isExporting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting...</>
                  ) : (
                    <><Download className="mr-2 h-4 w-4" /> Export SQL Dump</>
                  )}
                </Button>
              </div>

              <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                <h4 className="text-sm font-medium">Restore Backup</h4>
                <p className="text-xs text-muted-foreground">
                  Upload a <code>.sql</code> or <code>.sql.gz</code> file. An auto-backup is created first.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".sql,.gz,.sql.gz"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="restore-upload"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isRestoring}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  {isRestoring ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {restorePhase === 'backup' ? 'Creating auto-backup...' : 'Restoring...'}</>
                  ) : (
                    <><Upload className="mr-2 h-4 w-4" /> Select Backup File</>
                  )}
                </Button>
              </div>
            </div>

            {restorePhase === 'confirm' && pendingFileName && (
              <div className="rounded-lg border border-amber-500/50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-500">
                  <ShieldAlert className="h-5 w-5" />
                  <span className="font-medium">Confirm Restore</span>
                </div>
                <p className="text-sm">You are about to restore from: <strong>{pendingFileName}</strong></p>
                <div className="rounded-lg bg-amber-500/10 p-3 text-sm space-y-1">
                  <p className="font-medium">This will:</p>
                  <ul className="list-disc list-inside text-muted-foreground">
                    <li>Create an automatic backup of the current database first</li>
                    <li>Drop all existing tables</li>
                    <li>Restore the database from the uploaded file</li>
                  </ul>
                </div>
                <div className="flex gap-3">
                  <Button onClick={confirmRestore} disabled={isRestoring} size="sm" className="flex-1">
                    {isRestoring ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : 'Confirm Restore'}
                  </Button>
                  <Button onClick={cancelRestore} variant="outline" size="sm" disabled={isRestoring}>Cancel</Button>
                </div>
              </div>
            )}

            {isRestoring && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {restorePhase === 'backup' ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <CheckCircle className="h-5 w-5 text-green-500" />}
                  <div>
                    <p className="font-medium text-sm">Creating auto-backup</p>
                    <p className="text-xs text-muted-foreground">Saving current database state</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {restorePhase === 'restore' ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : restorePhase === 'done' ? <CheckCircle className="h-5 w-5 text-green-500" /> : <div className="h-5 w-5 rounded-full border-2 border-muted" />}
                  <div>
                    <p className="font-medium text-sm">Restoring data</p>
                    <p className="text-xs text-muted-foreground">Importing from backup file</p>
                  </div>
                </div>
              </div>
            )}

            {restorePhase === 'done' && !isRestoring && (
              <div className={`rounded-lg border p-4 space-y-3 ${restoreError ? 'border-destructive/50' : 'border-green-500/50'}`}>
                <div className={`flex items-center gap-2 ${restoreError ? 'text-destructive' : 'text-green-500'}`}>
                  {restoreError ? <XCircle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                  <span className="font-medium">{restoreError ? 'Restore Failed' : 'Restore Complete'}</span>
                </div>
                {restoreError ? (
                  <p className="text-sm text-destructive">{restoreError}</p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Database has been restored from the backup file.</p>
                    {autoBackupPath && (
                      <div className="rounded-lg bg-muted/50 p-3 text-sm">
                        <p className="font-medium mb-1">Auto-backup saved at:</p>
                        <code className="text-xs break-all">{autoBackupPath}</code>
                      </div>
                    )}
                  </>
                )}
                <Button onClick={() => { setRestorePhase('idle'); setRestoreError(null); setAutoBackupPath(null); setPendingFileName(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} variant="outline" size="sm">
                  Dismiss
                </Button>
              </div>
            )}

            <div className="rounded-lg border border-destructive/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">Clear All Data</span>
              </div>
              <p className="text-sm text-muted-foreground">
                This will permanently delete ALL data. This action cannot be undone!
              </p>
              <Button onClick={handleClearData} disabled={isClearing} variant="destructive" size="sm" className="w-full">
                {isClearing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Clearing...</> : <><Trash2 className="mr-2 h-4 w-4" /> Clear All Data</>}
              </Button>
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
