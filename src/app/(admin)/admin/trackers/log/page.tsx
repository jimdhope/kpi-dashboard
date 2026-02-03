
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, Timestamp, doc, onSnapshot, Unsubscribe, serverTimestamp, orderBy, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CalendarIcon, Loader2, Filter, CheckSquare, Save, Send, ListFilter } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { TrackerKpi } from '@/app/(admin)/admin/trackers/setup/page';
import { TrackerCard } from '@/components/tracker-card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


export interface TrackerLog {
  id?: string;
  agentId: string;
  podId: string;
  trackerKpiId: string;
  date: Timestamp;
  value: number;
  loggedAt: Timestamp;
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

const SCORES_POD_KEY = 'trackerScores_selectedPodIds';
const SCORES_DATE_KEY = 'trackerScores_selectedDate';

const debounce = (func: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout | null = null;
  return (...args: any[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};


export default function LogTrackerPage() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [kpis, setKpis] = useState<TrackerKpi[]>([]);
  const [selectedPodIds, setSelectedPodIds] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [inputs, setInputs] = useState<KpiInputState>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const savedPodIds = localStorage.getItem(SCORES_POD_KEY);
    if (savedPodIds) {
      try {
        const parsed = JSON.parse(savedPodIds);
        if (Array.isArray(parsed)) {
          setSelectedPodIds(parsed);
        }
      } catch (e) {
        console.error("Failed to parse saved pod IDs from localStorage", e);
        localStorage.removeItem(SCORES_POD_KEY);
      }
    }
    const savedDate = localStorage.getItem(SCORES_DATE_KEY);
    if (savedDate) setSelectedDate(new Date(savedDate));
  }, []);

  const handlePodSelectionChange = (podId: string) => {
    const newSelectedPodIds = selectedPodIds.includes(podId)
        ? selectedPodIds.filter(id => id !== podId)
        : [...selectedPodIds, podId];
    setSelectedPodIds(newSelectedPodIds);
    localStorage.setItem(SCORES_POD_KEY, JSON.stringify(newSelectedPodIds));
  };

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
        setSelectedDate(startOfDay(date));
        localStorage.setItem(SCORES_DATE_KEY, date.toISOString());
    }
  };

  useEffect(() => {
    setIsLoading(true);
    const unsubscribes: Unsubscribe[] = [];
    
    unsubscribes.push(onSnapshot(query(collection(db, 'pods'), orderBy('name')), (snap) => {
      setPods(snap.docs.map(d => ({ id: d.id, ...d.data() } as Pod)));
    }));

    unsubscribes.push(onSnapshot(query(collection(db, 'trackerKpis'), orderBy('name')), (snap) => {
      setKpis(snap.docs.map(d => ({ id: d.id, ...d.data() } as TrackerKpi)));
      setIsLoading(false);
    }));

    return () => unsubscribes.forEach(unsub => unsub());
  }, []);

  useEffect(() => {
    if (selectedPodIds.length === 0) {
      setAgents([]);
      setInputs({});
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    const unsubscribes: Unsubscribe[] = [];

    const agentsQuery = query(collection(db, 'users'), where('podId', 'in', selectedPodIds), where('roles', 'array-contains', 'agent'), orderBy('name'));
    unsubscribes.push(onSnapshot(agentsQuery, (snap) => {
      setAgents(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
    }));

    const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
    const logsQuery = query(collection(db, 'trackerLogs'), where('podId', 'in', selectedPodIds), where('date', '==', dateTimestamp));
    unsubscribes.push(onSnapshot(logsQuery, (snap) => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as TrackerLog));
      const newInputs: KpiInputState = {};
      agents.forEach(agent => {
          if (!agent.id) return;
          newInputs[agent.id] = {};
          kpis.forEach(kpi => {
              if (!kpi.id) return;
              const existingLog = logs.find(log => log.agentId === agent.id && log.trackerKpiId === kpi.id);
              const val = existingLog ? String(existingLog.value) : '0';
              newInputs[agent.id][kpi.id] = { value: val, initialValue: val, logId: existingLog?.id };
          });
      });
      setInputs(newInputs);
      setIsLoading(false);
    }, (error) => {
        console.error("Error fetching logs: ", error);
        setIsLoading(false);
    }));

    return () => unsubscribes.forEach(unsub => unsub());
  }, [selectedPodIds, selectedDate, agents, kpis]); // Re-run when agents list changes


  const handleSaveTrackerScore = useCallback(async (agentId: string, kpiId: string, valueStr: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent?.podId) return;

    const savingKey = `${agentId}-${kpiId}`;
    setIsSaving(prev => ({...prev, [savingKey]: true }));

    const value = parseInt(valueStr, 10);
    const valueIsNumeric = !isNaN(value);

    try {
        const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
        const logsCollectionRef = collection(db, 'trackerLogs');
        const existingLogId = inputs[agentId]?.[kpiId]?.logId;

        if (valueStr === '' || !valueIsNumeric || value <= 0) {
            if (existingLogId) {
                await deleteDoc(doc(logsCollectionRef, existingLogId));
                setInputs(prev => {
                    const newState = {...prev};
                    if(newState[agentId]?.[kpiId]) newState[agentId][kpiId].logId = undefined;
                    return newState;
                });
            }
        } else {
             const logEntry: Omit<TrackerLog, 'id'> = {
                agentId,
                podId: agent.podId,
                trackerKpiId: kpiId,
                date: dateTimestamp,
                value,
                loggedAt: serverTimestamp() as Timestamp,
            };
            
            const logDocRef = existingLogId ? doc(logsCollectionRef, existingLogId) : doc(logsCollectionRef);
            await setDoc(logDocRef, logEntry, { merge: true });

            if (!existingLogId) {
                setInputs(prev => ({ ...prev, [agentId]: { ...prev[agentId], [kpiId]: { ...prev[agentId][kpiId], logId: logDocRef.id }}}));
            }
        }
    } catch(e) {
        toast({ title: "Auto-Save Error", description: "Could not save score.", variant: "destructive" });
    } finally {
        setIsSaving(prev => ({...prev, [savingKey]: false }));
    }
  }, [agents, inputs, selectedDate, toast]);
  
  const debouncedSave = useMemo(() => debounce(handleSaveTrackerScore, 1000), [handleSaveTrackerScore]);

  const handleInputChange = useCallback((agentId: string, kpiId: string, newValue: string) => {
    if (newValue !== '' && (!/^\d*$/.test(newValue))) return;
    
    setInputs(prev => ({
        ...prev,
        [agentId]: { ...prev[agentId], [kpiId]: { ...(prev[agentId]?.[kpiId]), value: newValue } }
    }));
    debouncedSave(agentId, kpiId, newValue);
  }, [debouncedSave]);

 const handleSendToTeams = async () => {
    setIsSending(true);
    toast({ title: "Coming Soon!", description: "Sending tracker data to Microsoft Teams is not yet implemented." });
    setIsSending(false);
  };

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
                  <Label htmlFor="pod-select">Pods</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button id="pod-select" variant="outline" className="w-[200px] justify-between" disabled={isLoading}>
                         {selectedPodIds.length === 0 ? "Select Pods" : `${selectedPodIds.length} selected`}
                         <ListFilter className="h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                      <DropdownMenuLabel>Pods</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {pods.map(pod => (
                          <DropdownMenuCheckboxItem
                              key={pod.id}
                              checked={selectedPodIds.includes(pod.id)}
                              onCheckedChange={() => handlePodSelectionChange(pod.id)}
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
                    <PopoverTrigger asChild><Button id="date-select" variant="outline" className={cn("w-[200px] justify-start", !selectedDate && "text-muted-foreground")} disabled={isLoading}><CalendarIcon className="mr-2 h-4 w-4" />{selectedDate ? format(selectedDate, "PPP") : "Pick date"}</Button></PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50"><Calendar mode="single" selected={selectedDate} onSelect={handleDateChange} initialFocus/></PopoverContent>
                </Popover>
                </div>
            </div>
            <div className="flex gap-2">
                 <Button onClick={handleSendToTeams} disabled={isSending || selectedPodIds.length === 0 || agents.length === 0} variant="secondary">
                     {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                     Send to Teams
                 </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    
      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CheckSquare className="h-5 w-5" /> Log Tracker Scores</CardTitle>
          <CardDescription>Enter the scores for each agent. Changes are saved automatically.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
          ) : selectedPodIds.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">Please select one or more pods to begin.</p>
          ) : kpis.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No trackers have been set up yet.</p>
          ) : agents.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No agents found in the selected pod(s).</p>
          ) : (
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="min-w-[150px]">Agent</TableHead>
                            <TableHead>Tracker Scores</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {agents.map(agent => (
                        <TableRow key={agent.id}>
                            <TableCell className="font-medium align-top pt-6">{agent.name}</TableCell>
                            <TableCell>
                               <div className="flex flex-wrap items-center gap-4">
                                {kpis.map(kpi => (
                                    <div key={kpi.id} className="min-w-[200px]">
                                        <TrackerCard
                                            kpi={kpi}
                                            value={inputs[agent.id!]?.[kpi.id!]?.value ?? '0'}
                                            isSaving={isSaving[`${agent.id!}-${kpi.id!}`] || false}
                                            onValueChange={(newValue) => handleInputChange(agent.id!, kpi.id!, newValue)}
                                        />
                                    </div>
                                ))}
                               </div>
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
