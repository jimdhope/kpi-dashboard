'use client';

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download, Upload, Trash2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface RestoreResult {
  table: string;
  imported: number;
  errors: string[];
}

export default function BackupPage() {
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [restoreResults, setRestoreResults] = useState<RestoreResult[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/settings/backup', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to export backup');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `kpi-quest-backup-${new Date().toISOString().split('T')[0]}.json`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast({
        title: 'Backup exported',
        description: `Downloaded ${filename}`,
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    setRestoreResults(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const response = await fetch('/api/settings/backup/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to restore backup');
      }

      setRestoreResults(result.results);
      toast({
        title: 'Backup restored',
        description: 'Data has been imported successfully',
      });
    } catch (error) {
      toast({
        title: 'Restore failed',
        description: error instanceof Error ? error.message : 'Invalid backup file',
        variant: 'destructive',
      });
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClearData = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to clear ALL data? This action cannot be undone!'
    );

    if (!confirmed) return;

    setIsClearing(true);
    try {
      const response = await fetch('/api/settings/backup/clear', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to clear data');
      }

      toast({
        title: 'Data cleared',
        description: 'All application data has been deleted',
      });
    } catch (error) {
      toast({
        title: 'Clear failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Backup & Restore</h1>
        <p className="text-muted-foreground">
          Export your data for safekeeping or restore from a backup file
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Backup
            </CardTitle>
            <CardDescription>
              Download all your data as a JSON file
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Creates a complete backup including competitions, trackers, performance data, 
              mini-games, directory contacts, knowledge base articles, and settings.
            </p>
            <Button onClick={handleExport} disabled={isExporting} className="w-full">
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Export Data
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Restore Backup
            </CardTitle>
            <CardDescription>
              Import data from a backup file
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Restore data from a previously exported backup file. Existing records will be 
              updated if they have the same ID, otherwise new records will be created.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleRestore}
              className="hidden"
              id="restore-upload"
            />
            <Button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={isRestoring}
              variant="outline"
              className="w-full"
            >
              {isRestoring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Select Backup File
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card md:col-span-2 border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Clear All Data
            </CardTitle>
            <CardDescription>
              Permanently delete all application data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              This will permanently delete ALL data including users, competitions, trackers, 
              knowledge base, directory, and settings. Use with extreme caution - this 
              action cannot be undone!
            </p>
            <Button 
              onClick={handleClearData} 
              disabled={isClearing}
              variant="destructive"
              className="w-full"
            >
              {isClearing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All Data
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {restoreResults && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Restore Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {restoreResults.map((result) => (
                <div 
                  key={result.table} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    {result.errors.length > 0 ? (
                      <XCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    <span className="font-medium">{result.table}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium">{result.imported} imported</span>
                    {result.errors.length > 0 && (
                      <p className="text-xs text-destructive">{result.errors[0]}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}