
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, Timestamp, doc, onSnapshot, Unsubscribe, serverTimestamp, writeBatch, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CalendarIcon, Loader2, Filter, CheckSquare, Save, Send, ListFilter, Plus, Minus } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { TrackerKpi } from '@/app/(admin)/admin/trackers/setup/page';
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
    };
  };
}

const SCORES_POD_KEY = 'trackerScores_selectedPodIds'; // Changed key name
const SCORES_DATE_KEY = 'trackerScores_selectedDate';


export default function LogTrackerPage() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [kpis, setKpis] = useState<TrackerKpi[]>([]);
  const [selectedPodIds, setSelectedPodIds] = useState<string[]>([]); // Changed to array
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [inputs, setInputs] = useState<KpiInputState>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
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
    // Firestore 'in' queries are limited to 30 elements. If more pods are selected, this will fail.
    // For this app's scale, it's acceptable. For larger scale, multiple queries would be needed.
    const logsQuery = query(collection(db, 'trackerLogs'), where('podId', 'in', selectedPodIds), where('date', '==', dateTimestamp));
    unsubscribes.push(onSnapshot(logsQuery, (snap) => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as TrackerLog));
      const newInputs: KpiInputState = {};
      logs.forEach(log => {
        if (!newInputs[log.agentId]) newInputs[log.agentId] = {};
        const val = String(log.value);
        newInputs[log.agentId][log.trackerKpiId] = { value: val, initialValue: val };
      });
      setInputs(newInputs);
      setIsLoading(false);
    }));

    return () => unsubscribes.forEach(unsub => unsub());
  }, [selectedPodIds, selectedDate]);


  const handleSaveAll = async () => {
    setIsSaving(true);
    const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
    const logsCollectionRef = collection(db, 'trackerLogs');
    const batch = writeBatch(db);

    try {
        for (const agentId in inputs) {
            const agent = agents.find(a => a.id === agentId);
            if (!agent?.podId) continue; // Skip if we can't determine the agent's pod

            for (const kpiId in inputs[agentId]) {
                const entry = inputs[agentId][kpiId];
                if (entry.value === entry.initialValue) continue;

                const valueStr = entry.value;
                const value = parseFloat(valueStr);

                const logQuery = query(logsCollectionRef, where('agentId', '==', agentId), where('trackerKpiId', '==', kpiId), where('date', '==', dateTimestamp));
                const logSnapshot = await getDocs(logQuery);
                const existingLogDoc = logSnapshot.docs[0];
                const logDocRef = existingLogDoc ? existingLogDoc.ref : doc(logsCollectionRef);

                if (valueStr === '' || isNaN(value)) {
                    if (existingLogDoc) batch.delete(logDocRef);
                } else {
                    const logEntry: Omit<TrackerLog, 'id' | 'loggedAt'> & { loggedAt: any } = {
                        agentId, 
                        podId: agent.podId, // Use the agent's actual podId
                        trackerKpiId: kpiId,
                        date: dateTimestamp, 
                        value, 
                        loggedAt: serverTimestamp(),
                    };
                    batch.set(logDocRef, logEntry, { merge: true });
                }
            }
        }
        
        await batch.commit();
        toast({ title: "Tracker Scores Saved", description: "All changes have been successfully saved." });
    } catch (e: any) {
        console.error("Error saving tracker scores:", e);
        toast({ title: "Save Error", description: `Could not save scores. ${e.message}`, variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
};

 const handleSendToTeams = async () => {
    setIsSending(true);
    // TODO: Implement webhook logic
    // 1. Get Pod's webhook URL
    // 2. Format data into a markdown table or Adaptive Card
    // 3. Send POST request to webhook URL
    toast({ title: "Coming Soon!", description: "Sending tracker data to Microsoft Teams is not yet implemented." });
    setIsSending(false);
  };


  const handleInputChange = (agentId: string, kpiId: string, value: string) => {
    setInputs(prev => {
        const agentData = prev[agentId] || {};
        const kpiData = agentData[kpiId] || { value: '', initialValue: '' };
        return { ...prev, [agentId]: { ...agentData, [kpiId]: { ...kpiData, value } } };
    });
  };

  const handleValueChange = (agentId: string, kpiId: string, change: number) => {
    const currentValue = parseFloat(inputs[agentId]?.[kpiId]?.value || '0');
    // If currentValue is NaN (e.g., from an empty string), treat it as 0.
    const baseValue = isNaN(currentValue) ? 0 : currentValue;
    const newValue = Math.max(0, baseValue + change);

    handleInputChange(agentId, kpiId, String(newValue));
  };


  const renderInput = (agentId: string, kpi: TrackerKpi) => {
    const value = inputs[agentId]?.[kpi.id]?.value ?? '';
    return (
        <div className="flex items-center justify-center gap-1 w-full">
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleValueChange(agentId, kpi.id, -1)}
                disabled={isSaving || !value || parseFloat(value) <= 0}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              type="number"
              placeholder="-"
              value={value}
              min={0}
              onChange={(e) => handleInputChange(agentId, kpi.id, e.target.value)}
              className="h-8 w-16 text-center"
              disabled={isSaving}
            />
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleValueChange(agentId, kpi.id, 1)}
                disabled={isSaving}
            >
              <Plus className="h-4 w-4" />
            </Button>
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
                 <Button onClick={handleSaveAll} disabled={isSaving || !hasChanges}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                    {isSaving ? "Saving..." : "Save Scores"}
                 </Button>
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
          <CardDescription>Enter the scores for each agent against the defined trackers.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
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

    