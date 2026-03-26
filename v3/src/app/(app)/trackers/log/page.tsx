'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CalendarIcon, Loader2, Filter, Send, ListFilter, Settings, Minus, Plus } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { AppPod, PodMemberSummary, TrackerKpiRecord } from '@/lib/contracts';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface KpiInputState {
  [agentId: string]: {
    [kpiId: string]: {
      value: string;
      initialValue: string;
      logId?: string;
    };
  };
}

interface TrackerLog {
  userId: string;
  trackerKpiId: string;
  value: number;
}

const SCORES_POD_KEY = 'trackerScores_selectedPodId';
const SCORES_DATE_KEY = 'trackerScores_selectedDate';
const TRACKER_WEBHOOK_URL_KEY = 'tracker_webhookUrl';

const debounce = (func: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout | null = null;
  return (...args: any[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

export default function LogTrackerPage() {
  const [pods, setPods] = useState<AppPod[]>([]);
  const [agents, setAgents] = useState<PodMemberSummary[]>([]);
  const [kpis, setKpis] = useState<TrackerKpiRecord[]>([]);
  const [logs, setLogs] = useState<TrackerLog[]>([]);
  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [inputs, setInputs] = useState<KpiInputState>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [tempWebhookUrl, setTempWebhookUrl] = useState('');

  useEffect(() => {
    const savedPodId = localStorage.getItem(SCORES_POD_KEY);
    if (savedPodId) setSelectedPodId(savedPodId);
    const savedDate = localStorage.getItem(SCORES_DATE_KEY);
    if (savedDate) setSelectedDate(new Date(savedDate));
    const savedWebhookUrl = localStorage.getItem(TRACKER_WEBHOOK_URL_KEY);
    if (savedWebhookUrl) {
      setWebhookUrl(savedWebhookUrl);
      setTempWebhookUrl(savedWebhookUrl);
    }
  }, []);

  // Fetch pods
  useEffect(() => {
    async function fetchPods() {
      try {
        const res = await fetch('/api/pods');
        if (res.ok) {
          const data = await res.json();
          setPods(data.pods || []);
        }
      } catch (e) {
        console.error('Failed to fetch pods:', e);
      }
    }
    fetchPods();
  }, []);

  // Fetch tracker KPIs
  useEffect(() => {
    async function fetchKpis() {
      try {
        const res = await fetch('/api/trackers');
        if (res.ok) {
          const data = await res.json();
          setKpis(data.trackers || []);
        }
      } catch (e) {
        console.error('Failed to fetch KPIs:', e);
      }
    }
    fetchKpis();
  }, []);

  // Fetch agents when pod is selected
  useEffect(() => {
    async function fetchAgents() {
      if (!selectedPodId) {
        setAgents([]);
        return;
      }
      try {
        const res = await fetch(`/api/pods/${selectedPodId}/members`);
        if (res.ok) {
          const data = await res.json();
          // Filter to only agents
          const agentMembers = (data.members || []).filter(
            (m: PodMemberSummary) => m.roles?.includes('agent')
          );
          setAgents(agentMembers);
        }
      } catch (e) {
        console.error('Failed to fetch agents:', e);
      }
    }
    fetchAgents();
  }, [selectedPodId]);

  // Fetch logs when pod and date are selected
  useEffect(() => {
    async function fetchLogs() {
      if (!selectedPodId) {
        setLogs([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const res = await fetch(`/api/performance/logs?podId=${selectedPodId}&date=${dateStr}`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
        }
      } catch (e) {
        console.error('Failed to fetch logs:', e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchLogs();
  }, [selectedPodId, selectedDate]);

  // Initialize inputs from logs
  useEffect(() => {
    setInputs(currentInputs => {
      const newInputs: KpiInputState = {};
      agents.forEach(agent => {
        newInputs[agent.id] = {};
        kpis.forEach(kpi => {
          const log = logs.find(l => l.userId === agent.id && l.trackerKpiId === kpi.id);
          const dbValue = log ? String(log.value) : '0';
          
          const currentAgentKpiInput = currentInputs[agent.id]?.[kpi.id];
          const valueToDisplay = (currentAgentKpiInput && currentAgentKpiInput.initialValue === dbValue)
            ? currentAgentKpiInput.value
            : dbValue;
          
          newInputs[agent.id][kpi.id] = {
            value: valueToDisplay,
            initialValue: dbValue,
          };
        });
      });
      return newInputs;
    });
  }, [agents, kpis, logs]);

  const handleSaveTrackerScore = useCallback(async (agentId: string, kpiId: string, valueStr: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;

    const savingKey = `${agentId}-${kpiId}`;
    setIsSaving(prev => ({...prev, [savingKey]: true }));

    const value = parseInt(valueStr, 10);
    const valueIsNumeric = !isNaN(value);

    try {
      const existingLog = logs.find(l => l.userId === agentId && l.trackerKpiId === kpiId);

      if (valueStr === '' || !valueIsNumeric || value <= 0) {
        // Delete log if it exists and value is invalid
        if (existingLog) {
          // Note: Would need a DELETE endpoint or similar to remove logs
          console.log('Would delete log:', existingLog);
        }
      } else {
        // Create or update log
        const res = await fetch('/api/performance/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trackerKpiId: kpiId,
            value: value,
            loggedAt: selectedDate.toISOString(),
          }),
        });

        if (!res.ok) {
          throw new Error('Failed to save');
        }

        const newLog = await res.json();
        
        // Update local state
        setLogs(prev => {
          const filtered = prev.filter(l => !(l.userId === agentId && l.trackerKpiId === kpiId));
          return [...filtered, newLog.log];
        });
      }
    } catch(e) {
      toast({ title: "Auto-Save Error", description: "Could not save score.", variant: "destructive" });
    } finally {
      setIsSaving(prev => ({...prev, [savingKey]: false }));
    }
  }, [agents, logs, selectedDate, toast]);

  const debouncedSave = useMemo(() => debounce(handleSaveTrackerScore, 1000), [handleSaveTrackerScore]);

  const handleInputChange = useCallback((agentId: string, kpiId: string, newValue: string) => {
    if (newValue !== '' && (!/^\d*$/.test(newValue))) return;
    
    setInputs(prev => ({
      ...prev,
      [agentId]: { ...prev[agentId], [kpiId]: { ...(prev[agentId]?.[kpiId]), value: newValue } }
    }));
    debouncedSave(agentId, kpiId, newValue);
  }, [debouncedSave]);

  const handleIncrement = useCallback((agentId: string, kpiId: string, currentValue: string) => {
    const numericValue = parseInt(currentValue, 10) || 0;
    handleInputChange(agentId, kpiId, String(numericValue + 1));
  }, [handleInputChange]);

  const handleDecrement = useCallback((agentId: string, kpiId: string, currentValue: string) => {
    const numericValue = parseInt(currentValue, 10) || 0;
    if (numericValue > 0) {
      handleInputChange(agentId, kpiId, String(numericValue - 1));
    }
  }, [handleInputChange]);

  const handlePodChange = (podId: string) => {
    setSelectedPodId(podId);
    localStorage.setItem(SCORES_POD_KEY, podId);
  };

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(startOfDay(date));
      localStorage.setItem(SCORES_DATE_KEY, date.toISOString());
    }
  };

  const handleSendToTeams = async () => {
    if (!webhookUrl) {
      toast({
        title: "Webhook URL missing",
        description: "Please configure the webhook URL in settings first.",
        variant: "destructive",
      });
      return;
    }
    setIsSending(true);

    const dataToSend = agents
      .map(agent => {
        const agentAchievements = kpis
          .map(kpi => {
            const value = parseInt(inputs[agent.id]?.[kpi.id]?.value || '0', 10);
            return { kpiName: kpi.name, value };
          })
          .filter(ach => ach.value > 0);

        if (agentAchievements.length > 0) {
          return {
            agentName: agent.name,
            achievements: agentAchievements,
          };
        }
        return null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (dataToSend.length === 0) {
      toast({
        title: "No Data to Send",
        description: "No agents have tracked scores for the selected date.",
      });
      setIsSending(false);
      return;
    }

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: format(selectedDate, 'yyyy-MM-dd'),
          data: dataToSend,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to send');
      }

      toast({
        title: "Report Sent",
        description: "The tracker report was successfully sent to Teams.",
      });
    } catch (error: any) {
      toast({
        title: "Send Failed",
        description: error.message || "An unknown error occurred while sending to Teams.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveWebhookUrl = () => {
    setWebhookUrl(tempWebhookUrl);
    localStorage.setItem(TRACKER_WEBHOOK_URL_KEY, tempWebhookUrl);
    toast({
      title: "Settings Saved",
      description: "Webhook URL has been updated.",
    });
    setIsSettingsOpen(false);
  };

  const canSendToTeams = selectedPodId && agents.length > 0 && webhookUrl && !isSending;

  return (
    <div className="space-y-6">
      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" /> Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end justify-between">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="grid gap-2">
                <Label htmlFor="pod-select">Pod</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button id="pod-select" variant="outline" className="w-[200px] justify-between" disabled={isLoading}>
                      {selectedPodId 
                        ? pods.find(p => p.id === selectedPodId)?.name || "Select Pod"
                        : "Select Pod"}
                      <ListFilter className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <DropdownMenuLabel>Pods</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {pods.map(pod => (
                      <DropdownMenuCheckboxItem
                        key={pod.id}
                        checked={selectedPodId === pod.id}
                        onCheckedChange={() => handlePodChange(pod.id)}
                      >
                        {pod.name}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date-select">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button id="date-select" variant="outline" className={cn("w-[200px] justify-start", !selectedDate && "text-muted-foreground")} disabled={isLoading}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50">
                    <Calendar mode="single" selected={selectedDate} onSelect={handleDateChange} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSendToTeams} disabled={!canSendToTeams} variant="secondary">
                {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send to Teams
              </Button>
              <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Settings">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Webhook Settings</DialogTitle>
                    <DialogDescription>
                      Enter the Microsoft Teams webhook URL to send tracker results.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="webhook-url">Webhook URL</Label>
                      <Input
                        id="webhook-url"
                        value={tempWebhookUrl}
                        onChange={(e) => setTempWebhookUrl(e.target.value)}
                        placeholder="https://your-org.webhook.office.com/..."
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => setIsSettingsOpen(false)}>Cancel</Button>
                    <Button type="button" onClick={handleSaveWebhookUrl}>Save</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {isLoading ? (
          <Card className="frosted-glass">
            <CardHeader>
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-4 w-1/5" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            </CardContent>
          </Card>
        ) : !selectedPodId ? (
          <Card className="frosted-glass">
            <CardContent className="text-center py-10">
              <p className="text-muted-foreground mb-4">Please select a pod to begin.</p>
            </CardContent>
          </Card>
        ) : kpis.length === 0 ? (
          <Card className="frosted-glass">
            <CardContent className="text-center py-10">
              <p className="text-muted-foreground mb-4">No trackers have been set up yet.</p>
              <Button asChild variant="secondary">
                <a href="/trackers/setup">Set Up Trackers</a>
              </Button>
            </CardContent>
          </Card>
        ) : agents.length === 0 ? (
          <Card className="frosted-glass">
            <CardContent className="text-center py-10">
              <p className="text-muted-foreground mb-4">No agents found in the selected pod.</p>
              <Button asChild variant="secondary">
                <a href="/settings/pods">Manage Pods</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="frosted-glass">
            <CardHeader>
              <CardTitle>Log Daily Trackers</CardTitle>
              <CardDescription>Track metrics for each agent. Changes are saved automatically.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="sticky left-0 z-10 bg-muted/50 w-[200px]">Agent</TableHead>
                      {kpis.map(kpi => (
                        <TableHead key={kpi.id} className="text-center min-w-[100px]">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs font-normal">{kpi.name}</span>
                            {kpi.unit && <span className="text-[10px] text-muted-foreground">({kpi.unit})</span>}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map(agent => (
                      <TableRow key={agent.id}>
                        <TableCell className="sticky left-0 z-10 bg-background font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded border-2 border-green-500 bg-green-500/20 flex items-center justify-center">
                              <span className="text-xs text-green-600">✓</span>
                            </div>
                            <span>{agent.name}</span>
                          </div>
                        </TableCell>
                        {kpis.map(kpi => {
                          const savingKey = `${agent.id}-${kpi.id}`;
                          const isSavingThis = isSaving[savingKey] || false;
                          return (
                            <TableCell key={kpi.id} className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  value={inputs[agent.id]?.[kpi.id]?.value ?? '0'}
                                  onChange={(e) => handleInputChange(agent.id, kpi.id, e.target.value)}
                                  className="w-14 h-8 text-center"
                                  disabled={isSavingThis}
                                />
                                <div className="flex flex-col">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-6 text-xs"
                                    onClick={() => handleIncrement(agent.id, kpi.id, inputs[agent.id]?.[kpi.id]?.value ?? '0')}
                                    disabled={isSavingThis}
                                    aria-label={`Increment ${kpi.name} for ${agent.name}`}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-6 text-xs"
                                    onClick={() => handleDecrement(agent.id, kpi.id, inputs[agent.id]?.[kpi.id]?.value ?? '0')}
                                    disabled={isSavingThis || parseInt(inputs[agent.id]?.[kpi.id]?.value ?? '0') <= 0}
                                    aria-label={`Decrement ${kpi.name} for ${agent.name}`}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
