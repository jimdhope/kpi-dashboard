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
import { Loader2, Send, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ sentTo: string[]; failed: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchPods();
    }
  }, [open, competitionId, date]);

  useEffect(() => {
    if (pods.length > 0) {
      const selectablePods = pods.filter(p => p.webhookConfigured && p.webhookActive);
      setSelectedPodIds(new Set(selectablePods.map(p => p.podId)));
    }
  }, [pods]);

  const fetchPods = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

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
      setError(err instanceof Error ? err.message : 'Failed to fetch pods');
    } finally {
      setIsLoading(false);
    }
  };

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
      const response = await fetch(
        `/api/competitions/${competitionId}/send-daily-scores`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: dateStr,
            podIds: Array.from(selectedPodIds),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send scores');
      }

      setResult({
        sentTo: data.sentTo || [],
        failed: data.failed || [],
      });

      if (data.sentTo?.length > 0 && onSuccess) {
        onSuccess(data.sentTo);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send scores');
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
          ) : pods.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No pods found in this competition
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Select which pods to send the daily scores update to:
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {pods.map(pod => {
                  const isDisabled = !pod.webhookConfigured || !pod.webhookActive;
                  const isSelected = selectedPodIds.has(pod.podId);

                  return (
                    <div
                      key={pod.podId}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                        isDisabled
                          ? "bg-muted/50 border-muted cursor-not-allowed"
                          : "hover:bg-muted/50 border-border"
                      )}
                    >
                      <Checkbox
                        id={`pod-${pod.podId}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => handlePodToggle(pod.podId, !!checked)}
                        disabled={isDisabled}
                      />
                      <Label
                        htmlFor={`pod-${pod.podId}`}
                        className={cn(
                          "flex-1 cursor-pointer",
                          isDisabled && "cursor-not-allowed opacity-50"
                        )}
                      >
                        <span className="font-medium">{pod.podName}</span>
                        <span className="ml-2 text-sm text-muted-foreground">
                          ({pod.agents.length} agent{pod.agents.length !== 1 ? 's' : ''})
                        </span>
                      </Label>
                      <div className="flex items-center gap-1 text-sm">
                        {pod.webhookConfigured && pod.webhookActive ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            Ready
                          </span>
                        ) : !pod.webhookConfigured ? (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <XCircle className="h-4 w-4" />
                            No webhook
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-yellow-600">
                            <AlertCircle className="h-4 w-4" />
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 pt-2 border-t">
                <Checkbox
                  id="select-all"
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  disabled={selectablePods.length === 0}
                />
                <Label
                  htmlFor="select-all"
                  className="font-medium cursor-pointer"
                >
                  Select All
                </Label>
              </div>

              {error && (
                <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button
              onClick={handleSend}
              disabled={isLoading || isSending || selectedPodIds.size === 0}
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
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
