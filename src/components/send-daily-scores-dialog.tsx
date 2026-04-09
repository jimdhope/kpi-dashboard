'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Send, AlertCircle, CheckCircle2, XCircle, Table, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface PodOption {
  podId: string;
  podName: string;
  agents: Array<{
    agentId: string;
    agentName: string;
    score: number;
    rank: number;
    hasActivity: boolean;
  }>;
  hasWebhook: boolean;
  webhookConfigured: boolean;
  webhookActive: boolean;
}

interface SendDailyScoresDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competitionId: string;
  competitionName: string;
  date: Date;
  onSuccess?: (sentTo: string[]) => void;
}

type TableFormat = 'separate' | 'combined';

const STORAGE_KEY = 'teams-card-table-format';

export function SendDailyScoresDialog({
  open,
  onOpenChange,
  competitionId,
  competitionName,
  date,
  onSuccess,
}: SendDailyScoresDialogProps) {
  const [pods, setPods] = useState<PodOption[]>([]);
  const [selectedPodIds, setSelectedPodIds] = useState<Set<string>>(new Set());
  const [tableFormat, setTableFormat] = useState<TableFormat>('separate');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ sentTo: string[]; failed: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load saved preference on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'combined' || saved === 'separate') {
      setTableFormat(saved);
    }
  }, []);

  // Save preference when changed
  const handleTableFormatChange = (format: TableFormat) => {
    setTableFormat(format);
    localStorage.setItem(STORAGE_KEY, format);
  };

  useEffect(() => {
    if (open) {
      fetchPods();
    }
  }, [open, competitionId, date]);

  const fetchPods = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const response = await fetch(
        `/api/competitions/${competitionId}/send-daily-scores?date=${dateStr}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch pod data');
      }

      const data = await response.json();
      setPods(data.pods || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pods');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (pods.length > 0) {
      const selectablePods = pods.filter(p => p.webhookConfigured && p.webhookActive);
      setSelectedPodIds(new Set(selectablePods.map(p => p.podId)));
    }
  }, [pods]);

  const handlePodToggle = (podId: string, checked: boolean) => {
    setSelectedPodIds(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(podId);
      } else {
        next.delete(podId);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const selectablePods = pods.filter(p => p.webhookConfigured && p.webhookActive);
      setSelectedPodIds(new Set(selectablePods.map(p => p.podId)));
    } else {
      setSelectedPodIds(new Set());
    }
  };

  const handleSend = async () => {
    if (selectedPodIds.size === 0) {
      setError('Please select at least one pod to send to');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const payload = {
        date: dateStr,
        podIds: Array.from(selectedPodIds),
        tableFormat,
      };

      const response = await fetch(
        `/api/competitions/${competitionId}/send-daily-scores`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send to Teams');
      }

      const data = await response.json();
      setResult({
        sentTo: data.sentTo || [],
        failed: data.failed || [],
      });

      if (data.sentTo && data.sentTo.length > 0 && onSuccess) {
        onSuccess(data.sentTo);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send to Teams');
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setError(null);
    setPods([]);
    setSelectedPodIds(new Set());
    onOpenChange(false);
  };

  const selectablePods = pods.filter(p => p.webhookConfigured && p.webhookActive);
  const allSelected = selectablePods.length > 0 && selectedPodIds.size === selectablePods.length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Daily Scores to Teams</DialogTitle>
          <DialogDescription>
            {format(date, 'MMMM d, yyyy')} - {competitionName}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : result ? (
            <div className="space-y-4">
              {result.sentTo.length > 0 && (
                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">
                      Successfully sent to {result.sentTo.length} pod{result.sentTo.length !== 1 ? 's' : ''}
                    </p>
                    <ul className="mt-1 text-sm text-green-700 dark:text-green-300 space-y-0.5">
                      {result.sentTo.map(name => (
                        <li key={name}>• {name}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {result.failed.length > 0 && (
                <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-red-800 dark:text-red-200">
                      Failed to send to {result.failed.length} pod{result.failed.length !== 1 ? 's' : ''}
                    </p>
                    <ul className="mt-1 text-sm text-red-700 dark:text-red-300 space-y-0.5">
                      {result.failed.map(reason => (
                        <li key={reason}>• {reason}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ) : error && pods.length === 0 ? (
            <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">Error</p>
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          ) : selectablePods.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">
                No pods with active webhooks configured.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Configure webhooks in Settings to send cards.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Table Format Toggle */}
              {selectablePods.length > 1 && (
                <div className="flex items-center gap-2 pb-3 border-b">
                  <button
                    type="button"
                    onClick={() => handleTableFormatChange('separate')}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                      tableFormat === 'separate'
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Table className="h-4 w-4" />
                    Separate
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTableFormatChange('combined')}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                      tableFormat === 'combined'
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <List className="h-4 w-4" />
                    Combined
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select-all" className="font-medium">
                  Select all pods ({selectablePods.length})
                </Label>
              </div>

              <div className="border rounded-lg divide-y">
                {selectablePods.map(pod => (
                  <div
                    key={pod.podId}
                    className="flex items-start gap-3 p-3"
                  >
                    <Checkbox
                      id={pod.podId}
                      checked={selectedPodIds.has(pod.podId)}
                      onCheckedChange={checked =>
                        handlePodToggle(pod.podId, checked as boolean)
                      }
                      className="mt-1"
                    />
                    <Label
                      htmlFor={pod.podId}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="font-medium">{pod.podName}</div>
                      <div className="text-sm text-muted-foreground">
                        {pod.agents.length} agent{pod.agents.length !== 1 ? 's' : ''} •{' '}
                        {pod.agents.reduce((sum, a) => sum + a.score, 0)} pts total
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {result ? (
            <Button onClick={handleClose}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={isSending || selectedPodIds.size === 0}
              >
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send to Teams
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}