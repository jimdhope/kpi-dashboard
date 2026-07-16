'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Database, Upload, RefreshCw, CheckCircle, XCircle, AlertCircle, Loader2, Terminal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface ImportStatus {
  collection: string;
  inFile: number;
  inDb: number;
  status: 'complete' | 'partial' | 'missing';
}

interface ImportLog {
  id: string;
  importedAt: string;
  source: string;
  durationMs: number;
  status: string;
}

interface ConsoleLine {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  timestamp: Date;
}

export default function DataImportPage({ embedded = false }: { embedded?: boolean }) {
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<ImportStatus[]>([]);
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([]);
  const [progress, setProgress] = useState(0);
  const consoleRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [consoleLines]);

  const addConsoleLine = (message: string, type: ConsoleLine['type'] = 'info') => {
    setConsoleLines(prev => [...prev, {
      id: Date.now() + Math.random(),
      message,
      type,
      timestamp: new Date()
    }]);
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/settings/import/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status || []);
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Error fetching import status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      addConsoleLine(`Selected file: ${file.name}`, 'info');
    }
  };

  const handleUpload = async () => {
    if (!uploadedFile) return;

    setIsSyncing(true);
    addConsoleLine('Uploading export file...', 'info');

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const res = await fetch('/api/settings/import/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        addConsoleLine('File uploaded successfully', 'success');
        await handleSync('upload');
      } else {
        const data = await res.json();
        addConsoleLine(`Upload failed: ${data.error}`, 'error');
      }
    } catch (error) {
      addConsoleLine(`Upload error: ${error}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSync = async (source: 'existing' | 'upload' = 'existing') => {
    setIsSyncing(true);
    setProgress(0);
    setConsoleLines([]);
    
    let sourceLabel = 'Existing export file';
    if (source === 'upload') sourceLabel = 'Uploaded file';
    
    addConsoleLine('Starting sync...', 'info');
    addConsoleLine(`Source: ${sourceLabel}`, 'info');

    const collections = ['users', 'pods', 'competitions', 'competitionTeams', 'competitionRules', 'achievements', 'podMemberships'];
    const totalCollections = collections.length;

    try {
      const res = await fetch('/api/settings/import/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      });

      if (res.ok) {
        const data = await res.json();
        
        // Log each result
        for (let i = 0; i < data.results.length; i++) {
          const result = data.results[i];
          const collectionProgress = ((i + 1) / totalCollections) * 100;
          setProgress(collectionProgress);
          
          if (result.errors > 0) {
            addConsoleLine(`[${result.collection}] Imported: ${result.imported}, Updated: ${result.updated}, Errors: ${result.errors}`, 'warning');
          } else {
            addConsoleLine(`[${result.collection}] Imported: ${result.imported}, Updated: ${result.updated}`, 'success');
          }
          
          // Small delay to show progress
          await new Promise(r => setTimeout(r, 300));
        }

        setProgress(100);
        addConsoleLine(`✓ Sync complete in ${(data.duration / 1000).toFixed(2)}s`, 'success');
        
        // Refresh status
        await fetchStatus();
      } else {
        const data = await res.json();
        addConsoleLine(`Sync failed: ${data.error}`, 'error');
      }
    } catch (error) {
      addConsoleLine(`Sync error: ${error}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'partial':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'missing':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete':
        return 'bg-green-500';
      case 'partial':
        return 'bg-yellow-500';
      case 'missing':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!embedded && <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Database className="h-8 w-8 text-primary" />
          Data Import
        </h1>
        <p className="text-muted-foreground mt-1">
          Import a KPI Quest JSON export into PostgreSQL
        </p>
      </div>}

      {/* Upload Section */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Import Source</CardTitle>
          <CardDescription>Choose how to import data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* File Upload */}
            <div className="flex-1">
              <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Upload a KPI Quest JSON export file
                </p>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload">
                  <Button variant="outline" size="sm" asChild>
                    <span>Choose File</span>
                  </Button>
                </label>
                {uploadedFile && (
                  <p className="mt-2 text-sm text-green-500">
                    Selected: {uploadedFile.name}
                  </p>
                )}
              </div>
              {uploadedFile && (
                <Button 
                  className="w-full mt-2" 
                  onClick={handleUpload}
                  disabled={isSyncing}
                >
                  Upload & Sync
                </Button>
              )}
            </div>

            {/* Use Existing */}
            <div className="flex-1">
              <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                <Database className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Use existing kpi_quest_export.json
                </p>
                <Button 
                  onClick={() => handleSync('existing')}
                  disabled={isSyncing}
                >
                  {isSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Sync Now
                </Button>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          {isSyncing && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground text-center">
                {progress < 100 ? 'Syncing...' : 'Complete'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Collection Status */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Collection Status</CardTitle>
          <CardDescription>Current data in database vs export file</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {status.map((item) => (
              <div key={item.collection} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium capitalize">{item.collection}</span>
                  {getStatusIcon(item.status)}
                </div>
                <div className="text-sm text-muted-foreground">
                  <span className={getStatusColor(item.status)}>● </span>
                  DB: {item.inDb} / File: {item.inFile}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Console View */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Console
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            ref={consoleRef}
            className="bg-black text-green-400 font-mono text-sm p-4 rounded-lg h-[300px] overflow-y-auto"
          >
            {consoleLines.length === 0 ? (
              <span className="text-gray-500">Console output will appear here...</span>
            ) : (
              consoleLines.map((line) => (
                <div key={line.id} className="mb-1">
                  <span className="text-gray-500">
                    [{line.timestamp.toLocaleTimeString()}]
                  </span>{' '}
                  <span className={
                    line.type === 'error' ? 'text-red-400' :
                    line.type === 'success' ? 'text-green-400' :
                    line.type === 'warning' ? 'text-yellow-400' :
                    'text-blue-400'
                  }>
                    {line.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Import History */}
      {logs.length > 0 && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Import History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {logs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-center justify-between border-b pb-2">
                  <div>
                    <span className="text-sm">
                      {new Date(log.importedAt).toLocaleString()}
                    </span>
                    <Badge variant="outline" className="ml-2">
                      {log.source}
                    </Badge>
                  </div>
                  <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                    {log.status} ({(log.durationMs / 1000).toFixed(1)}s)
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
