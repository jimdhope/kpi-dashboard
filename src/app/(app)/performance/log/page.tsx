
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, Timestamp, doc, onSnapshot, Unsubscribe, serverTimestamp, writeBatch, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CalendarIcon, Loader2, Filter, CheckSquare, Save } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { logKpiUpdated, getCurrentUserAsync } from '@/lib/firestore/activities';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { AdditionalKpi } from '@/app/(admin)/admin/additional-kpis/page';


export interface AdditionalKpiLog {
  id?: string;
  agentId: string;
  podId: string;
  kpiId: string;
  date: Timestamp;
  value: number;
  scoreOutOf?: number; // Only for 'scoreOutOf' type, stores the maxValue at time of logging
  loggedAt: Timestamp;
}

interface KpiInputState {
  [agentId: string]: {
    [kpiId: string]: {
      value: string;
      initialValue: string; // Store initial value to detect changes
      logId?: string;
    };
  };
}

const SCORES_POD_KEY = 'additionalScores_selectedPodId';
const SCORES_DATE_KEY = 'additionalScores_selectedDate';


export default function AdditionalScoresPage() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [kpis, setKpis] = useState<AdditionalKpi[]>([]);
  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [inputs, setInputs] = useState<KpiInputState>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const hasChanges = useMemo(() => {
    for (const agentId in inputs) {
        for (const kpiId in inputs[agentId]) {
            const entry = inputs[agentId][kpiId];
            if (entry.value !== entry.initialValue) {
                return true;
            }
        }
    }
    return false;
  }, [inputs]);


  // Load filters from localStorage
  useEffect(() => {
    const savedPodId = localStorage.getItem(SCORES_POD_KEY);
    if (savedPodId) setSelectedPodId(savedPodId);
    const savedDate = localStorage.getItem(SCORES_DATE_KEY);
    if (savedDate) setSelectedDate(new Date(savedDate));
  }, []);

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


  // Fetch base data (pods, KPIs)
  useEffect(() => {
    setIsLoading(true);
    const unsubscribes: Unsubscribe[] = [];
    
    unsubscribes.push(onSnapshot(query(collection(db, 'pods'), orderBy('name')), (snap) => {
      setPods(snap.docs.map(d => ({ id: d.id, ...d.data() } as Pod)));
    }));

    unsubscribes.push(onSnapshot(query(collection(db, 'additionalKpis'), orderBy('name')), (snap) => {
      setKpis(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdditionalKpi)));
      setIsLoading(false);
    }));

    return () => unsubscribes.forEach(unsub => unsub());
  }, []);

  // Fetch agents and logs when filters change
  useEffect(() => {
    if (!selectedPodId) {
      setAgents([]);
      setInputs({});
      return;
    }
    
    setIsLoading(true);
    const unsubscribes: Unsubscribe[] = [];

    // Fetch agents for the selected pod
    const agentsQuery = query(collection(db, 'users'), where('podId', '==', selectedPodId), where('roles', 'array-contains', 'agent'), orderBy('name'));
    unsubscribes.push(onSnapshot(agentsQuery, (snap) => {
      setAgents(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
    }));

    // Fetch logs for the selected pod and date
    const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
    const logsQuery = query(collection(db, 'additionalKpiLogs'), where('podId', '==', selectedPodId), where('date', '==', dateTimestamp));
    unsubscribes.push(onSnapshot(logsQuery, (snap) => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as AdditionalKpiLog));
      const newInputs: KpiInputState = {};
      logs.forEach(log => {
        if (!newInputs[log.agentId]) newInputs[log.agentId] = {};
        const val = String(log.value);
        newInputs[log.agentId][log.kpiId] = { value: val, logId: log.id, initialValue: val };
      });
      setInputs(newInputs);
      setIsLoading(false);
    }));

    return () => unsubscribes.forEach(unsub => unsub());
  }, [selectedPodId, selectedDate]);


  const handleSaveAll = async () => {
    setIsSaving(true);
    const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
    const logsCollectionRef = collection(db, 'additionalKpiLogs');
    const batch = writeBatch(db);
    let hasError = false;
    
    // Track changes for activity logging
    const changes: Array<{
      agentId: string;
      agentName: string;
      kpiId: string;
      kpiName: string;
      previousValue: number;
      newValue: number;
    }> = [];

    try {
        for (const agentId in inputs) {
            for (const kpiId in inputs[agentId]) {
                const entry = inputs[agentId][kpiId];
                if (entry.value === entry.initialValue) continue;

                const kpi = kpis.find(k => k.id === kpiId);
                if (!kpi) continue;

                const valueStr = entry.value;
                const value = parseFloat(valueStr);
                const valueIsNumeric = !isNaN(value);

                // Validation for scoreOutOf
                if (kpi.type === 'scoreOutOf' && kpi.maxValue !== undefined && value > kpi.maxValue) {
                    toast({ title: "Validation Error", description: `Score for "${kpi.name}" cannot exceed ${kpi.maxValue}.`, variant: "destructive" });
                    hasError = true;
                    continue; // Skip this entry
                }

                // Query for the existing document to get its reference
                const logQuery = query(
                    logsCollectionRef,
                    where('agentId', '==', agentId),
                    where('kpiId', '==', kpiId),
                    where('date', '==', dateTimestamp)
                );
                const logSnapshot = await getDocs(logQuery);
                const existingLogDoc = logSnapshot.docs[0];

                const logDocRef = existingLogDoc ? existingLogDoc.ref : doc(logsCollectionRef);

                if (valueStr === '' || !valueIsNumeric) {
                    // If the input is empty or not a number, and a log exists, delete it.
                    if (existingLogDoc) {
                        batch.delete(logDocRef);
                    }
                    // Track change for activity logging (delete = 0)
                    const agent = agents.find(a => a.id === agentId);
                    const previousValue = parseFloat(entry.initialValue) || 0;
                    changes.push({
                      agentId,
                      agentName: agent?.name || 'Unknown Agent',
                      kpiId,
                      kpiName: kpi.name,
                      previousValue,
                      newValue: 0,
                    });
                } else {
                    // Otherwise, create or update the log.
                    const logEntry: Omit<AdditionalKpiLog, 'id' | 'loggedAt'> & { loggedAt: any } = {
                        agentId,
                        podId: selectedPodId,
                        kpiId,
                        date: dateTimestamp,
                        value,
                        loggedAt: serverTimestamp(),
                    };
                    
                    if (kpi.type === 'scoreOutOf' && typeof kpi.maxValue === 'number') {
                        logEntry.scoreOutOf = kpi.maxValue;
                    }
                    
                    batch.set(logDocRef, logEntry, { merge: true });
                    
                    // Track change for activity logging
                    const agent = agents.find(a => a.id === agentId);
                    const previousValue = parseFloat(entry.initialValue) || 0;
                    changes.push({
                      agentId,
                      agentName: agent?.name || 'Unknown Agent',
                      kpiId,
                      kpiName: kpi.name,
                      previousValue,
                      newValue: value,
                    });
                }
            }
        }
        
        if (hasError) {
             toast({ title: "Save Incomplete", description: "Please fix the validation errors before saving.", variant: "destructive" });
        } else {
             await batch.commit();
             
             // Log activities for each KPI update
             if (changes.length > 0) {
               // Get current user info for recorder attribution
               const currentUser = await getCurrentUserAsync();
               
               // Log activities for each changed KPI
               await Promise.all(
                 changes.map(async (change) => {
                   try {
                     // Only set recorder info if the current user is different from the agent
                     const isSelfLogging = currentUser?.id === change.agentId;
                     await logKpiUpdated(
                       change.agentId,
                       change.agentName,
                       change.kpiId,
                       change.kpiName,
                       change.previousValue,
                       change.newValue
                     );
                   } catch (activityError) {
                     // Log error but don't fail the save operation
                     console.error('[Performance Log] Failed to log activity:', activityError);
                   }
                 })
               );
             }
             
             toast({
                 title: "Scores Saved",
                 description: "All changes have been successfully saved.",
             });
        }

    } catch (e: any) {
        console.error("[DEBUG] Error in handleSaveAll function:", e);
        toast({ title: "Save Error", description: `Could not save scores. ${e.message}`, variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };


  const handleInputChange = (agentId: string, kpiId: string, value: string) => {
    setInputs(prev => {
        const agentData = prev[agentId] || {};
        const kpiData = agentData[kpiId] || { value: '', initialValue: '' };

        return {
            ...prev,
            [agentId]: {
                ...agentData,
                [kpiId]: { ...kpiData, value }
            }
        };
    });
  };


  const renderInput = (agentId: string, kpi: AdditionalKpi) => {
    const value = inputs[agentId]?.[kpi.id]?.value ?? '';
    
    return (
        <div className="relative">
            <Input
                type="number"
                placeholder="-"
                value={value}
                max={kpi.type === 'scoreOutOf' ? kpi.maxValue : undefined}
                min={0}
                onChange={(e) => handleInputChange(agentId, kpi.id, e.target.value)}
                className="h-8"
            />
        </div>
    );
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
                <Label htmlFor="pod-select">Pod</Label>
                <Select onValueChange={handlePodChange} value={selectedPodId} disabled={isLoading}>
                    <SelectTrigger id="pod-select" className="w-[200px]"><SelectValue placeholder="Select Pod" /></SelectTrigger>
                    <SelectContent>{pods.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
                </div>
                <div className="grid gap-2">
                <Label htmlFor="date-select">Date</Label>
                <Popover>
                    <PopoverTrigger asChild><Button id="date-select" variant="outline" className={cn("w-[200px] justify-start", !selectedDate && "text-muted-foreground")} disabled={isLoading}><CalendarIcon className="mr-2 h-4 w-4" />{selectedDate ? format(selectedDate, "PPP") : "Pick date"}</Button></PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50"><Calendar mode="single" selected={selectedDate} onSelect={handleDateChange} initialFocus/></PopoverContent>
                </Popover>
                </div>
            </div>
             <Button onClick={handleSaveAll} disabled={isSaving || !hasChanges}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                {isSaving ? "Saving..." : "Save All Scores"}
             </Button>
          </div>
        </CardContent>
      </Card>
    
      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CheckSquare className="h-5 w-5" /> Log Additional Scores</CardTitle>
          <CardDescription>Enter the daily scores for each agent against the defined KPIs.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
          ) : !selectedPodId ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground">Please select a pod to begin.</p>
            </div>
          ) : kpis.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-3">No additional KPIs have been set up yet.</p>
              <Button asChild size="sm">
                <a href="/admin/additional-kpis">Set Up KPIs</a>
              </Button>
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-3">No agents found in the selected pod.</p>
              <Button asChild size="sm" variant="secondary">
                <a href="/settings/pods">Manage Pods</a>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow>
                        <TableHead className="min-w-[150px]">Agent</TableHead>
                        {kpis.map(kpi => (
                            <TableHead key={kpi.id} className="min-w-[150px] text-center" title={kpi.name}>
                                {kpi.initials}
                            </TableHead>
                        ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {agents.map(agent => (
                        <TableRow key={agent.id}>
                            <TableCell className="font-medium">{agent.name}</TableCell>
                            {kpis.map(kpi => (
                            <TableCell key={kpi.id}>
                                {renderInput(agent.id!, kpi)}
                            </TableCell>
                            ))}
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
