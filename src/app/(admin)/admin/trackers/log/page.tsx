
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
import { CalendarIcon, Loader2, Filter, CheckSquare, Save, Send, ListFilter, Settings } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { sendTrackerDataToTeams, type TrackerData } from '@/services/teamsWebhook';


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
const TRACKER_WEBHOOK_URL_KEY = 'tracker_webhookUrl';

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
  const [logs, setLogs] = useState<TrackerLog[]>([]); // New state for logs
  const [selectedPodIds, setSelectedPodIds] = useState<string[]>([]);
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
    const savedWebhookUrl = localStorage.getItem(TRACKER_WEBHOOK_URL_KEY);
    if (savedWebhookUrl) {
      setWebhookUrl(savedWebhookUrl);
      setTempWebhookUrl(savedWebhookUrl);
    }
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

  // Effect to fetch static data like Pods and KPIs
  useEffect(() => {
    setIsLoading(true);
    const unsubscribes: Unsubscribe[] = [];
    
    unsubscribes.push(onSnapshot(query(collection(db, 'pods'), orderBy('name')), (snap) => {
      setPods(snap.docs.map(d => ({ id: d.id, ...d.data() } as Pod)));
    }));

    unsubscribes.push(onSnapshot(query(collection(db, 'trackerKpis'), orderBy('name')), (snap) => {
      setKpis(snap.docs.map(d => ({ id: d.id, ...d.data() } as TrackerKpi)));
      setIsLoading(false); // Can consider loading finished after this
    }));

    return () => unsubscribes.forEach(unsub => unsub());
  }, []);

  // Effect to fetch agents when pod selection changes
  useEffect(() => {
    if (selectedPodIds.length === 0) {
      setAgents([]);
      return;
    }
    setIsLoading(true);
    const agentsQuery = query(collection(db, 'users'), where('podId', 'in', selectedPodIds), where('roles', 'array-contains', 'agent'), orderBy('name'));
    const unsubscribe = onSnapshot(agentsQuery, (snap) => {
        setAgents(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
    });

    return () => unsubscribe();
  }, [selectedPodIds]);

  // Effect to fetch logs when pod or date selection changes
  useEffect(() => {
      if (selectedPodIds.length === 0) {
          setLogs([]);
          setIsLoading(false);
          return;
      }
      setIsLoading(true);
      const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
      const logsQuery = query(collection(db, 'trackerLogs'), where('podId', 'in', selectedPodIds), where('date', '==', dateTimestamp));
      const unsubscribe = onSnapshot(logsQuery, (snap) => {
          setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as TrackerLog)));
          setIsLoading(false);
      }, (error) => {
          console.error("Error fetching logs: ", error);
          setIsLoading(false);
      });

      return () => unsubscribe();
  }, [selectedPodIds, selectedDate]);


  // Effect to compose the `inputs` state from fetched data, while preserving user input
  useEffect(() => {
    setInputs(currentInputs => {
        const newInputs: KpiInputState = {};
        agents.forEach(agent => {
            if (!agent.id) return;
            newInputs[agent.id] = {};
            kpis.forEach(kpi => {
                if (!kpi.id) return;
                
                const log = logs.find(l => l.agentId === agent.id && l.trackerKpiId === kpi.id);
                const dbValue = log ? String(log.value) : '0';
                const logId = log?.id;

                const currentAgentKpiInput = currentInputs[agent.id]?.[kpi.id];

                // If DB value is unchanged from what's in our state's 'initialValue',
                // it means the source data hasn't changed, so we can keep the user's typed value.
                // Otherwise, we should update to the new value from the database.
                const valueToDisplay = (currentAgentKpiInput && currentAgentKpiInput.initialValue === dbValue)
                    ? currentAgentKpiInput.value
                    : dbValue;
                
                newInputs[agent.id][kpi.id] = {
                    value: valueToDisplay,
                    initialValue: dbValue, // Always update initialValue to reflect the latest from DB
                    logId: logId,
                };
            });
        });
        return newInputs;
    });
  }, [agents, kpis, logs]); // This effect now safely composes state


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
    if (!webhookUrl) {
      toast({
        title: "Webhook URL missing",
        description: "Please configure the webhook URL in settings first.",
        variant: "destructive",
      });
      return;
    }
    setIsSending(true);

    const dataToSend: TrackerData[] = agents
      .map(agent => {
        const agentAchievements = kpis
          .map(kpi => {
            const value = parseInt(inputs[agent.id!]?.[kpi.id!]?.value || '0', 10);
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
      .filter((item): item is TrackerData => item !== null);

    if (dataToSend.length === 0) {
      toast({
        title: "No Data to Send",
        description: "No agents have tracked scores for the selected date.",
      });
      setIsSending(false);
      return;
    }

    try {
      await sendTrackerDataToTeams(webhookUrl, selectedDate, dataToSend);
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
                 <Button onClick={handleSendToTeams} disabled={isSending || selectedPodIds.length === 0 || agents.length === 0 || !webhookUrl} variant="secondary">
                     {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                     Send to Teams
                 </Button>
                 <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="icon" title="Settings">
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
            <div className="space-y-6">
                {Array.from({ length: 2 }).map((_, podIndex) => (
                    <Card key={podIndex} className="frosted-glass">
                        <CardHeader>
                            <Skeleton className="h-6 w-1/4" />
                            <Skeleton className="h-4 w-1/5" />
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {Array.from({ length: 4 }).map((_, agentIndex) => (
                                    <Card key={agentIndex} className="bg-background/50 shadow-inner">
                                        <CardHeader className="p-3">
                                            <Skeleton className="h-5 w-3/4" />
                                        </CardHeader>
                                        <CardContent className="p-3 pt-0 space-y-2">
                                            <Skeleton className="h-24 w-full" />
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        ) : selectedPodIds.length === 0 ? (
            <Card className="frosted-glass"><CardContent><p className="text-muted-foreground text-center py-10">Please select one or more pods to begin.</p></CardContent></Card>
        ) : kpis.length === 0 ? (
            <Card className="frosted-glass"><CardContent><p className="text-muted-foreground text-center py-10">No trackers have been set up yet.</p></CardContent></Card>
        ) : agents.length === 0 ? (
            <Card className="frosted-glass"><CardContent><p className="text-muted-foreground text-center py-10">No agents found in the selected pod(s).</p></CardContent></Card>
        ) : (
            selectedPodIds.map(podId => {
                const pod = pods.find(p => p.id === podId);
                const podAgents = agents.filter(a => a.podId === podId).sort((a, b) => a.name.localeCompare(b.name));

                if (!pod || podAgents.length === 0) return null;

                return (
                    <Card key={podId} className="frosted-glass">
                        <CardHeader>
                            <CardTitle>{pod.name}</CardTitle>
                            <CardDescription>{podAgents.length} agent(s) in this pod.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {podAgents.map(agent => (
                                    <Card key={agent.id} className="bg-background/50 shadow-inner">
                                        <CardHeader className="p-3">
                                            <CardTitle className="text-base">{agent.name}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-3 pt-0 space-y-2">
                                            {kpis.map(kpi => (
                                                <TrackerCard
                                                    key={kpi.id}
                                                    kpi={kpi}
                                                    value={inputs[agent.id!]?.[kpi.id!]?.value ?? '0'}
                                                    isSaving={isSaving[`${agent.id!}-${kpi.id!}`] || false}
                                                    onValueChange={(newValue) => handleInputChange(agent.id!, kpi.id!, newValue)}
                                                />
                                            ))}
                                            {kpis.length === 0 && <p className="text-xs text-muted-foreground">No trackers defined.</p>}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )
            })
        )}
        </div>
    </div>
  );
}
