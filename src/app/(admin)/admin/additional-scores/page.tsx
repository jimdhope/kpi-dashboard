
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, getDocs, Timestamp, doc, setDoc, deleteDoc, onSnapshot, Unsubscribe, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CalendarIcon, Loader2, Filter, CheckSquare } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
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
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

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
        newInputs[log.agentId][log.kpiId] = { value: String(log.value), logId: log.id };
      });
      setInputs(newInputs);
      setIsLoading(false);
    }));

    return () => unsubscribes.forEach(unsub => unsub());
  }, [selectedPodId, selectedDate]);


  const handleSave = useCallback(async (agentId: string, kpiId: string, valueStr: string) => {
    const kpi = kpis.find(k => k.id === kpiId);
    if (!kpi) return;
  
    const savingKey = `${agentId}-${kpiId}`;
    setIsSaving(prev => ({...prev, [savingKey]: true }));
  
    const logId = inputs[agentId]?.[kpiId]?.logId;
    const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
  
    try {
      // Check if the input is empty first
      if (valueStr === '') {
        // If the input is empty and a log exists, delete it
        if (logId) {
          await deleteDoc(doc(db, 'additionalKpiLogs', logId));
        }
        // If input is empty and no log exists, do nothing
      } else {
        // If input is not empty, parse it
        const value = parseFloat(valueStr);
        // Check if the parsed value is a valid number
        if (isNaN(value)) {
          // If not a valid number but a log exists, delete it (treat invalid input as empty)
          if (logId) {
            await deleteDoc(doc(db, 'additionalKpiLogs', logId));
          }
          // Do nothing if invalid and no log exists
        } else {
          // The value is a valid number, so create or update the log
          const logEntry: Omit<AdditionalKpiLog, 'id'> = {
            agentId,
            podId: selectedPodId,
            kpiId,
            date: dateTimestamp,
            value,
            scoreOutOf: kpi.type === 'scoreOutOf' ? kpi.maxValue : undefined,
            loggedAt: serverTimestamp() as Timestamp,
          };
          
          const docRef = logId ? doc(db, 'additionalKpiLogs', logId) : doc(collection(db, 'additionalKpiLogs'));
          await setDoc(docRef, logEntry, { merge: true });
        }
      }
    } catch (e) {
      console.error("Error saving score:", e);
      toast({ title: "Save Error", description: `Could not save score for ${kpi.name}.`, variant: "destructive" });
    } finally {
      setIsSaving(prev => ({...prev, [savingKey]: false }));
    }
  }, [inputs, kpis, selectedPodId, selectedDate, toast]);
  
  const debouncedSave = useMemo(() => {
    const debounce = (func: Function, delay: number) => {
        let timeoutId: NodeJS.Timeout;
        return (...args: any[]) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func(...args), delay);
        };
    };
    return debounce(handleSave, 1000);
  }, [handleSave]);

  const handleInputChange = (agentId: string, kpiId: string, value: string) => {
    setInputs(prev => ({
        ...prev,
        [agentId]: {
            ...prev[agentId],
            [kpiId]: { ...prev[agentId]?.[kpiId], value }
        }
    }));
    debouncedSave(agentId, kpiId, value);
  };


  const renderInput = (agentId: string, kpi: AdditionalKpi) => {
    const value = inputs[agentId]?.[kpi.id]?.value ?? '';
    const saving = isSaving[`${agentId}-${kpi.id}`] || false;

    return (
        <div className="relative">
            <Input
                type="number"
                placeholder="-"
                value={value}
                onChange={(e) => handleInputChange(agentId, kpi.id, e.target.value)}
                className="h-8 pr-8"
                disabled={saving}
            />
            {saving && <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />}
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
            <p className="text-muted-foreground text-center py-6">Please select a pod to begin.</p>
          ) : kpis.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No additional KPIs have been set up yet.</p>
          ) : agents.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No agents found in the selected pod.</p>
          ) : (
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow>
                        <TableHead className="min-w-[150px]">Agent</TableHead>
                        {kpis.map(kpi => (
                            <TableHead key={kpi.id} className="min-w-[150px] text-center">{kpi.emoji} {kpi.name}</TableHead>
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
