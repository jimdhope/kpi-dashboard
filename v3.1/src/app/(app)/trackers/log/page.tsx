'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarIcon, Filter, ListFilter, Minus, Plus, Users } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { AppPod, TrackerKpiRecord } from '@/lib/contracts';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


interface User {
  id: string;
  name: string;
  email: string;
}

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

interface PodData {
  pod: AppPod;
  agents: User[];
  logs: TrackerLog[];
  inputs: KpiInputState;
}

const SCORES_DATE_KEY = 'trackerScores_selectedDate';

const debounce = (func: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout | null = null;
  return (...args: any[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

export default function LogTrackerPage() {
  const [pods, setPods] = useState<AppPod[]>([]);
  const [kpis, setKpis] = useState<TrackerKpiRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  // Multi-pod data state
  const [podDataMap, setPodDataMap] = useState<Record<string, PodData>>({});
  const [selectedPodId, setSelectedPodId] = useState<string>(''); // Empty = all pods

  useEffect(() => {
    const savedDate = localStorage.getItem(SCORES_DATE_KEY);
    if (savedDate) setSelectedDate(new Date(savedDate));
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
          setKpis(data.kpis || []);
        }
      } catch (e) {
        console.error('Failed to fetch KPIs:', e);
      }
    }
    fetchKpis();
  }, []);

  // Fetch data for a single pod
  const fetchPodData = useCallback(async (podId: string) => {
    try {
      // Fetch agents and logs in parallel
      const [agentsRes, logsRes] = await Promise.all([
        fetch(`/api/pods/${podId}/members`),
        fetch(`/api/performance/logs?podId=${podId}&date=${format(selectedDate, 'yyyy-MM-dd')}`),
      ]);

      if (!agentsRes.ok || !logsRes.ok) return null;

      const agents: User[] = await agentsRes.json();
      const logsData = await logsRes.json();
      const logs: TrackerLog[] = logsData.logs || [];

      // Initialize inputs from logs
      const inputs: KpiInputState = {};
      agents.forEach(agent => {
        inputs[agent.id] = {};
        kpis.forEach(kpi => {
          const log = logs.find(l => l.userId === agent.id && l.trackerKpiId === kpi.id);
          inputs[agent.id][kpi.id] = {
            value: log ? String(log.value) : '0',
            initialValue: log ? String(log.value) : '0',
          };
        });
      });

      return {
        pod: pods.find(p => p.id === podId)!,
        agents,
        logs,
        inputs,
      };
    } catch (e) {
      console.error(`Failed to fetch data for pod ${podId}:`, e);
      return null;
    }
  }, [selectedDate, kpis, pods]);

  // Fetch data for all pods when date changes or pods are loaded
  useEffect(() => {
    async function fetchAllPodData() {
      if (pods.length === 0) return;
      setIsLoading(true);

      const results: Record<string, PodData> = {};
      
      for (const pod of pods) {
        const data = await fetchPodData(pod.id);
        if (data) {
          results[pod.id] = data;
        }
      }

      setPodDataMap(results);
      setIsLoading(false);
    }

    fetchAllPodData();
  }, [pods, selectedDate, kpis]);

  // Save tracker score
  const handleSaveTrackerScore = useCallback(async (
    podId: string,
    agentId: string, 
    kpiId: string, 
    valueStr: string
  ) => {
    const savingKey = `${podId}-${agentId}-${kpiId}`;
    setIsSaving(prev => ({...prev, [savingKey]: true }));

    const value = parseInt(valueStr, 10);
    const valueIsNumeric = !isNaN(value);

    try {
      if (valueStr === '' || !valueIsNumeric || value <= 0) {
        // Could implement delete here
      } else {
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
      }
    } catch(e) {
      toast({ title: "Auto-Save Error", description: "Could not save score.", variant: "destructive" });
    } finally {
      setIsSaving(prev => ({...prev, [savingKey]: false }));
    }
  }, [selectedDate, toast]);

  const debouncedSave = useMemo(
    () => debounce((podId: string, agentId: string, kpiId: string, value: string) => {
      handleSaveTrackerScore(podId, agentId, kpiId, value);
    }, 1000),
    [handleSaveTrackerScore]
  );

  const handleInputChange = useCallback((
    podId: string,
    agentId: string, 
    kpiId: string, 
    newValue: string
  ) => {
    if (newValue !== '' && (!/^\d*$/.test(newValue))) return;
    
    // Update local state immediately
    setPodDataMap(prev => {
      const updated = { ...prev };
      if (updated[podId]) {
        updated[podId] = {
          ...updated[podId],
          inputs: {
            ...updated[podId].inputs,
            [agentId]: {
              ...updated[podId].inputs[agentId],
              [kpiId]: {
                ...updated[podId].inputs[agentId][kpiId],
                value: newValue,
              },
            },
          },
        };
      }
      return updated;
    });

    debouncedSave(podId, agentId, kpiId, newValue);
  }, [debouncedSave]);

  const handleIncrement = useCallback((podId: string, agentId: string, kpiId: string, currentValue: string) => {
    const numericValue = parseInt(currentValue, 10) || 0;
    handleInputChange(podId, agentId, kpiId, String(numericValue + 1));
  }, [handleInputChange]);

  const handleDecrement = useCallback((podId: string, agentId: string, kpiId: string, currentValue: string) => {
    const numericValue = parseInt(currentValue, 10) || 0;
    if (numericValue > 0) {
      handleInputChange(podId, agentId, kpiId, String(numericValue - 1));
    }
  }, [handleInputChange]);

  const handlePodChange = (podId: string) => {
    setSelectedPodId(podId);
  };

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(startOfDay(date));
      localStorage.setItem(SCORES_DATE_KEY, date.toISOString());
    }
  };

  const hasData = Object.keys(podDataMap).length > 0;

  // Render a single pod's agent table
  const renderPodTable = (podData: PodData) => (
    <Card key={podData.pod.id} className="frosted-glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-4 w-4" />
          {podData.pod.name}
          <span className="text-sm font-normal text-muted-foreground ml-2">
            ({podData.agents.length} {podData.agents.length === 1 ? 'agent' : 'agents'})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {podData.agents.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No agents in this pod.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="sticky left-0 z-10 bg-muted/50 min-w-[120px] py-2">Agent</TableHead>
                  {kpis.map(kpi => (
                    <TableHead key={kpi.id} className="text-center min-w-[70px] py-2">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-normal">{kpi.name}</span>
                        {kpi.unit && <span className="text-[10px] text-muted-foreground">({kpi.unit})</span>}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {podData.agents.map(agent => (
                  <TableRow key={agent.id}>
                    <TableCell className="sticky left-0 z-10 bg-background font-medium py-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded border-2 border-green-500 bg-green-500/20 flex items-center justify-center shrink-0">
                          <span className="text-[10px] text-green-600">✓</span>
                        </div>
                        <span className="text-sm whitespace-nowrap truncate">{agent.name}</span>
                      </div>
                    </TableCell>
                    {kpis.map(kpi => {
                      const savingKey = `${podData.pod.id}-${agent.id}-${kpi.id}`;
                      const isSavingThis = isSaving[savingKey] || false;
                      return (
                        <TableCell key={kpi.id} className="text-center py-1.5">
                          <div className="flex items-center justify-center gap-0.5">
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={podData.inputs[agent.id]?.[kpi.id]?.value ?? '0'}
                              onChange={(e) => handleInputChange(podData.pod.id, agent.id, kpi.id, e.target.value)}
                              className="w-12 h-7 text-center text-sm"
                              disabled={isSavingThis}
                            />
                            <div className="flex flex-col">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-3 w-5 text-xs"
                                onClick={() => handleIncrement(podData.pod.id, agent.id, kpi.id, podData.inputs[agent.id]?.[kpi.id]?.value ?? '0')}
                                disabled={isSavingThis}
                                aria-label={`Increment ${kpi.name} for ${agent.name}`}
                              >
                                <Plus className="h-2.5 w-2.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-3 w-5 text-xs"
                                onClick={() => handleDecrement(podData.pod.id, agent.id, kpi.id, podData.inputs[agent.id]?.[kpi.id]?.value ?? '0')}
                                disabled={isSavingThis || parseInt(podData.inputs[agent.id]?.[kpi.id]?.value ?? '0') <= 0}
                                aria-label={`Decrement ${kpi.name} for ${agent.name}`}
                              >
                                <Minus className="h-2.5 w-2.5" />
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
        )}
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
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
      </div>
    );
  }

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
                <Label>Pod View</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-[200px] justify-between">
                      {selectedPodId 
                        ? pods.find(p => p.id === selectedPodId)?.name || "Select Pod"
                        : "All Pods"}
                      <ListFilter className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <DropdownMenuLabel>Pods</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={selectedPodId === ''}
                      onCheckedChange={() => handlePodChange('')}
                    >
                      All Pods
                    </DropdownMenuCheckboxItem>
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
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[200px] justify-start", !selectedDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto min-w-[300px] p-0 z-50">
                    <Calendar mode="single" selected={selectedDate} onSelect={handleDateChange} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {kpis.length === 0 ? (
          <Card className="frosted-glass">
            <CardContent className="text-center py-10">
              <p className="text-muted-foreground mb-4">No trackers have been set up yet.</p>
              <Button asChild variant="secondary">
                <a href="/trackers/setup">Set Up Trackers</a>
              </Button>
            </CardContent>
          </Card>
        ) : pods.length === 0 ? (
          <Card className="frosted-glass">
            <CardContent className="text-center py-10">
              <p className="text-muted-foreground mb-4">No pods have been created yet.</p>
              <Button asChild variant="secondary">
                <a href="/settings/pods">Manage Pods</a>
              </Button>
            </CardContent>
          </Card>
        ) : selectedPodId ? (
          // Single pod view
          podDataMap[selectedPodId] ? (
            renderPodTable(podDataMap[selectedPodId])
          ) : (
            <Card className="frosted-glass">
              <CardContent className="text-center py-10">
                <p className="text-muted-foreground mb-4">No agents found in the selected pod.</p>
                <Button asChild variant="secondary">
                  <a href="/settings/pods">Manage Pods</a>
                </Button>
              </CardContent>
            </Card>
          )
        ) : (
          // All pods view - separate cards for each pod
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 w-full">
            {pods.map(pod => {
              const podData = podDataMap[pod.id];
              if (!podData) return null;
              return renderPodTable(podData);
            })}
          </div>
        )}
      </div>
    </div>
  );
}
