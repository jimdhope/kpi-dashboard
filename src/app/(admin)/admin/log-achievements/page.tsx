
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  doc,
  getDoc,
  setDoc,
  addDoc,
  orderBy,
  serverTimestamp,
  limit,
  Unsubscribe,
  onSnapshot,
  deleteDoc,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { CalendarIcon, Loader2, AlertCircle, Filter, Send, Info } from 'lucide-react';
import { format, startOfDay, getDay } from 'date-fns';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { DailyTargetData } from '@/app/(admin)/admin/pod-targets/page';
import { sendTeamsUpdate, type AgentScoreForTeams, type PodTargetSummaryForTeams } from '@/services/teamsWebhook';
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


// Interface for the data stored in Firestore
export interface DailyAchievementLog {
  id?: string; // Firestore ID
  agentId: string;
  podId: string;
  competitionId: string;
  ruleId: string;
  ruleName: string;
  date: Timestamp;
  value: number;
  points: number;
  loggedAt: Timestamp;
  loggedBy?: string | null;
}

// Interface for managing state within the component
interface AchievementInputState {
  [agentId: string]: {
    [ruleId: string]: {
      value: string;
      existingLogId?: string;
    };
  };
}

const daysOfWeek = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const LOG_ACHIEVEMENTS_POD_KEY = 'logAchievementsPage_selectedPodId';
const KPIQUEST_AUTO_SEND_TEAMS_PREFIX = 'kpiQuest_autoSendTeams_';
const DEBOUNCE_SEND_DELAY = 20000; // 20 seconds
const DEBOUNCE_INPUT_SAVE_DELAY = 1000; // 1 second for saving individual input changes


// Custom hook for debouncing a callback
function useDebouncedCallback<A extends any[]>(
  callback: (...args: A) => void,
  delay: number
): (...args: A) => void {
  const latestCallback = useRef(callback);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // console.log('[useDebouncedCallback] Callback updated in ref.');
    latestCallback.current = callback;
  }, [callback]);

  return useCallback(
    (...args: A) => {
      // console.log(`[useDebouncedCallback] Debounce called with args:`, args, `at ${new Date().toLocaleTimeString()}`);
      if (timeoutIdRef.current) {
        // console.log('[useDebouncedCallback] Clearing previous timeout:', timeoutIdRef.current);
        clearTimeout(timeoutIdRef.current);
      }
      timeoutIdRef.current = setTimeout(() => {
        // console.log(`[useDebouncedCallback] Timeout fired at ${new Date().toLocaleTimeString()}! Executing callback.`);
        latestCallback.current(...args);
        timeoutIdRef.current = null; // Clear ref after execution
      }, delay);
      // console.log('[useDebouncedCallback] New timeout set:', timeoutIdRef.current);
    },
    [delay]
  );
}


export default function AdminLogAchievementsPage() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [competitionRules, setCompetitionRules] = useState<RuleFormData[]>([]);
  const [achievementInputs, setAchievementInputs] = useState<AchievementInputState>({});
  const [isLoadingPods, setIsLoadingPods] = useState(true);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [isLoadingRules, setIsLoadingRules] = useState(false);
  const [isLoadingInitialAchievements, setIsLoadingInitialAchievements] = useState(false);
  const [isSaving, setIsSaving] = useState<{ [key: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
  const [activeCompetitionId, setActiveCompetitionId] = useState<string | null>(null);

  const [isSendingToTeams, setIsSendingToTeams] = useState(false);
  const [dailyTargets, setDailyTargets] = useState<DailyTargetData | null>(null);
  const [currentDailyLogsForPod, setCurrentDailyLogsForPod] = useState<DailyAchievementLog[]>([]);
  const [autoSendToTeams, setAutoSendToTeams] = useState<boolean>(false);
  
  const isLoading = isLoadingPods || isLoadingAgents || isLoadingRules || isLoadingInitialAchievements;


  React.useEffect(() => {
    const savedPodId = localStorage.getItem(LOG_ACHIEVEMENTS_POD_KEY);
    if (savedPodId) {
        setSelectedPodId(savedPodId);
        const savedAutoSend = localStorage.getItem(`${KPIQUEST_AUTO_SEND_TEAMS_PREFIX}${savedPodId}`);
        setAutoSendToTeams(savedAutoSend === 'true');
    }
  }, []);

  const handleSelectedPodChange = (podId: string) => {
    setSelectedPodId(podId);
    localStorage.setItem(LOG_ACHIEVEMENTS_POD_KEY, podId);
    const savedAutoSend = localStorage.getItem(`${KPIQUEST_AUTO_SEND_TEAMS_PREFIX}${podId}`);
    setAutoSendToTeams(savedAutoSend === 'true');
  };

  const handleAutoSendToggle = (checked: boolean) => {
    setAutoSendToTeams(checked);
    if (selectedPodId) {
        localStorage.setItem(`${KPIQUEST_AUTO_SEND_TEAMS_PREFIX}${selectedPodId}`, String(checked));
         toast({
            title: "Auto-send Preference Updated",
            description: `Automatic Teams updates for this pod are now ${checked ? 'enabled' : 'disabled'}.`,
        });
    }
  };


  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUserUid(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);


  useEffect(() => {
    setIsLoadingPods(true);
    const podsRef = collection(db, 'pods');
    const q = query(podsRef, orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedPods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pod));
        setPods(fetchedPods);
        setError(null);
        setIsLoadingPods(false);
    }, (err) => {
        console.error("Error fetching pods:", err);
        setError("Failed to load pods.");
        toast({ variant: "destructive", title: "Error", description: "Could not load pods." });
        setIsLoadingPods(false);
    });
    return () => unsubscribe();
  }, [toast]);

  useEffect(() => {
    if (!selectedPodId) {
      setAgents([]);
      setCompetitionRules([]);
      setAchievementInputs({});
      setActiveCompetitionId(null);
      setDailyTargets(null);
      setCurrentDailyLogsForPod([]);
      setIsLoadingAgents(false);
      setIsLoadingRules(false);
      setIsLoadingInitialAchievements(false);
      return;
    }

    let unsubscribeLogs: Unsubscribe = () => {};
    let unsubscribeTargets: Unsubscribe = () => {};

    const fetchPodDataAndListen = async () => {
      setIsLoadingAgents(true);
      setIsLoadingRules(true);
      setIsLoadingInitialAchievements(true);
      setError(null);
      setAgents([]);
      setCompetitionRules([]);
      setAchievementInputs({});
      setActiveCompetitionId(null);
      setDailyTargets(null);
      setCurrentDailyLogsForPod([]);

      try {
        const usersRef = collection(db, 'users');
        const agentsQuery = query(
            usersRef,
            where('podId', '==', selectedPodId),
            where('roles', 'array-contains', 'agent'),
            orderBy('name')
        );
        const agentsSnapshot = await getDocs(agentsQuery);
        const fetchedAgents = agentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
        setAgents(fetchedAgents);
        setIsLoadingAgents(false);

        if (fetchedAgents.length === 0) {
            toast({ variant: "default", title: "No Agents", description: "No users with 'agent' role found in this pod." });
            setIsLoadingRules(false);
            setIsLoadingInitialAchievements(false);
            setActiveCompetitionId(null);
            return;
        }

        const competitionsRef = collection(db, 'competitions');
        const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
        const competitionQuery = query(
            competitionsRef,
            where('podIds', 'array-contains', selectedPodId),
            orderBy('startDate', 'desc'),
            limit(20)
        );
        const competitionSnapshot = await getDocs(competitionQuery);
        let competitionForLogging: (Competition & { id: string }) | null = null;

        for (const docSnap of competitionSnapshot.docs) {
            const comp = { id: docSnap.id, ...docSnap.data() } as Competition & { id: string };
            const startDate = comp.startDate instanceof Timestamp ? comp.startDate.toDate() : null;
            const endDate = comp.endDate instanceof Timestamp ? comp.endDate.toDate() : null;

            if (startDate && endDate && selectedDate >= startDate && selectedDate <= endDate) {
                competitionForLogging = comp;
                break;
            }
        }
        if (!competitionForLogging && competitionSnapshot.docs.length > 0) {
            const mostRecentValidComp = competitionSnapshot.docs.find(docSnap => {
                const comp = { id: docSnap.id, ...docSnap.data() } as Competition & { id: string };
                const startDate = comp.startDate instanceof Timestamp ? comp.startDate.toDate() : null;
                const endDate = comp.endDate instanceof Timestamp ? comp.endDate.toDate() : null;
                return startDate && endDate;
            });
            if (mostRecentValidComp) {
                competitionForLogging = { id: mostRecentValidComp.id, ...mostRecentValidComp.data() } as Competition & { id: string };
                 toast({ variant: "default", title: "Logging to Past/Future Competition", description: `No competition active for ${selectedDate.toLocaleDateString()}. Logging against "${competitionForLogging.name}". Ensure this is correct.` });
            }
        }

        if (competitionForLogging) {
            setActiveCompetitionId(competitionForLogging.id);
            setCompetitionRules(competitionForLogging.rules || []);
            setIsLoadingRules(false);

            const achievementsRef = collection(db, 'dailyAchievements');
            const initialAchievementsQuery = query(
                achievementsRef,
                where('podId', '==', selectedPodId),
                where('date', '==', dateTimestamp),
                where('competitionId', '==', competitionForLogging.id)
            );

            unsubscribeLogs = onSnapshot(initialAchievementsQuery, (snapshot) => {
                const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
                setCurrentDailyLogsForPod(logs); 

                const initialInputs: AchievementInputState = {};
                fetchedAgents.forEach(agent => {
                    if (!agent.id) return;
                    initialInputs[agent.id] = {};
                    (competitionForLogging?.rules || []).forEach(rule => {
                        if (!rule.id) return;
                        const existingLog = logs.find(log => log.agentId === agent.id && log.ruleId === rule.id);
                        initialInputs[agent.id!][rule.id] = {
                            value: existingLog ? String(existingLog.value) : '',
                            existingLogId: existingLog?.id,
                        };
                    });
                });
                setAchievementInputs(initialInputs);
                setIsLoadingInitialAchievements(false);

            }, (err) => {
                console.error("Error listening to daily logs:", err);
                setError("Failed to load real-time achievement data.");
                setIsLoadingInitialAchievements(false);
            });

            const targetsDocId = `${competitionForLogging.id}_${selectedPodId}`;
            const targetsDocRef = doc(db, 'dailyPodTargets', targetsDocId);
            unsubscribeTargets = onSnapshot(targetsDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    setDailyTargets(docSnap.data() as DailyTargetData);
                } else {
                    setDailyTargets(null);
                }
            }, (err) => {
                console.error("Error listening to daily targets:", err);
                setError("Failed to load daily target data.");
            });

        } else {
            setActiveCompetitionId(null);
            setCompetitionRules([]);
            toast({ variant: "default", title: "No Competition Found", description: `No competition found for this pod. Cannot log achievements.` });
            setIsLoadingRules(false);
            setIsLoadingInitialAchievements(false);
        }
      } catch (err) {
        console.error("Error fetching pod data:", err);
        setError("Failed to load data for the selected pod/date.");
        toast({ variant: "destructive", title: "Error", description: "Could not load agent or competition data." });
        setAgents([]); setCompetitionRules([]); setAchievementInputs({}); setActiveCompetitionId(null);
      } finally {

        if (isLoadingAgents) setIsLoadingAgents(false);
        if (isLoadingRules) setIsLoadingRules(false);
        if (isLoadingInitialAchievements) setIsLoadingInitialAchievements(false);
      }
    };

    fetchPodDataAndListen();
    return () => {
      unsubscribeLogs();
      unsubscribeTargets();
    };
  }, [selectedPodId, selectedDate, toast]);


  // Function that actually sends the Teams update
  const sendUpdateToTeamsLogicFn = () => {
    console.log(`[LogAchievementsPage] sendUpdateToTeamsLogicFn executing at ${new Date().toLocaleTimeString()}. AutoSend: ${autoSendToTeams}, Loading: ${isLoading}, Pod: ${selectedPodId}, Comp: ${activeCompetitionId}, User: ${!!currentUserUid}`);
    
    // Perform checks inside the function that is eventually called by the debouncer
    if (!autoSendToTeams || isLoading || !selectedPodId || !activeCompetitionId || !currentUserUid) {
      console.warn("[LogAchievementsPage] Send to Teams skipped: Conditions not met.", {
        autoSendToTeams, isLoading, selectedPodId, activeCompetitionId, currentUserUid: !!currentUserUid
      });
      // Important: Reset isSendingToTeams if we bail early.
      // However, setIsSendingToTeams should be controlled by the caller of the debounced function
      // or directly if this logic is for the manual send button.
      // For auto-send, the debouncer should manage the "sending" state around its actual execution.
      return;
    }
    
    const currentPod = pods.find(p => p.id === selectedPodId);
    if (!currentPod || !currentPod.teamsWebhookUrl) {
      console.warn(`[LogAchievementsPage] Webhook Missing for pod ${currentPod?.name || selectedPodId}.`);
      return;
    }

    console.log(`[LogAchievementsPage] Data for Teams: currentDailyLogsForPod count: ${currentDailyLogsForPod.length}`);
    
    if (currentDailyLogsForPod.length === 0 && (!dailyTargets || Object.keys(dailyTargets).length === 0)) {
        console.log("[LogAchievementsPage] No data (logs or targets) to send for Teams message.");
        return; // Don't send if there's nothing to report
    }
    
    setIsSendingToTeams(true); // Set sending state *before* the async operation

    const agentScoresForTeams: AgentScoreForTeams[] = agents.map(agent => {
      let totalPoints = 0;
      let emojiString = "";
      const agentLogs = currentDailyLogsForPod.filter(log => log.agentId === agent.id);

      const sortedRules = [...competitionRules].sort((a, b) => a.name.localeCompare(b.name));
      sortedRules.forEach(rule => {
        if (!rule.id) return;
        const logForRule = agentLogs.find(l => l.ruleId === rule.id);
        if (logForRule) {
          totalPoints += logForRule.points;
          const emojiToUse = rule.emoji && rule.emoji.trim() !== '' ? rule.emoji : '❓';
          for (let i = 0; i < logForRule.value; i++) {
            emojiString += emojiToUse;
          }
        }
      });
      return {
        agentFirstName: agent.name.split(' ')[0] || agent.name,
        totalPoints,
        emojiString: emojiString || '-',
      };
    }).sort((a, b) => a.agentFirstName.localeCompare(b.agentFirstName));

    const dayOfWeek = daysOfWeek[getDay(selectedDate)];
    const podTargetSummaryForTeams: PodTargetSummaryForTeams[] = competitionRules.map(rule => {
      if (!rule.id) return null;
      const achieved = currentDailyLogsForPod
        .filter(log => log.ruleId === rule.id)
        .reduce((sum, log) => sum + log.value, 0);
      const target = dailyTargets?.[rule.id]?.[dayOfWeek];
      if (target === undefined || target === null) return null;

      return {
        ruleName: rule.name,
        ruleEmoji: rule.emoji && rule.emoji.trim() !== '' ? rule.emoji : '❓',
        achieved,
        target,
      };
    }).filter((item): item is PodTargetSummaryForTeams => item !== null)
      .sort((a, b) => a.ruleName.localeCompare(b.ruleName));

    console.log(`[LogAchievementsPage] Attempting to send Teams update for pod ${currentPod.name}`);
    sendTeamsUpdate(
        currentPod.name,
        currentPod.teamsWebhookUrl,
        selectedDate,
        competitionRules,
        agentScoresForTeams,
        podTargetSummaryForTeams
    ).then(() => {
        console.log(`[LogAchievementsPage] Teams update SENT successfully for pod ${currentPod.name}.`);
        // No toast here for auto-send success to keep UI clean
    }).catch((err: any) => {
        console.error("[LogAchievementsPage] Error sending to Teams (auto):", err);
        // No toast here for auto-send failures
    }).finally(() => {
        setIsSendingToTeams(false); // Reset sending state
    });
  };
  
  // Create the debounced function using the custom hook.
  // sendUpdateToTeamsLogicFn is defined above, so it will be the latest version.
  const debouncedAutoSendToTeams = useDebouncedCallback(sendUpdateToTeamsLogicFn, DEBOUNCE_SEND_DELAY);

  // useEffect to trigger the debounced auto-send when relevant data changes
  useEffect(() => {
    console.log(`[LogAchievementsPage] Auto-send useEffect: autoSend=${autoSendToTeams}, isLoading=${isLoading}, activeComp=${activeCompetitionId}, selPod=${selectedPodId}, logsCount=${currentDailyLogsForPod.length}`);
    if (autoSendToTeams && !isLoading && activeCompetitionId && selectedPodId) {
        // The debounced function is called. It handles the timer internally.
        // The sendUpdateToTeamsLogicFn (which it will execute) will re-check conditions
        // like !isLoading etc. with the latest state when it's actually time to run.
        console.log(`[LogAchievementsPage] Conditions met. Calling debouncedAutoSendToTeams() at ${new Date().toLocaleTimeString()}`);
        debouncedAutoSendToTeams();
    }
  }, [currentDailyLogsForPod, autoSendToTeams, isLoading, activeCompetitionId, selectedPodId, debouncedAutoSendToTeams]);
  // ^ debouncedAutoSendToTeams is stable due to useDebouncedCallback, so it's safe in deps if needed,
  // but the primary trigger should be data changes.


  const handleSaveAchievementCallback = useCallback(async (agentId: string, ruleId: string, valueStr: string | undefined) => {
    if (!selectedPodId || !currentUserUid || !activeCompetitionId) {
      console.error("Pod, user, or active competition information missing for auto-save.");
      return;
    }

    const rule = competitionRules.find(r => r.id === ruleId);
    const agentInput = achievementInputs[agentId]?.[ruleId]; 

    if (!rule || agentInput === undefined) {
       console.error("Rule or input data not found for auto-save. Rule:", rule, "AgentInput for agentId", agentId, "ruleId", ruleId, ":", agentInput);
      return;
    }

    const value = parseInt(valueStr || '0', 10);

     if (isNaN(value) || value < 0) {
       console.warn("Invalid input value for auto-save:", valueStr);
       return;
     }
     
     const savingKey = `${agentId}-${ruleId}`;
     setIsSaving(prev => ({ ...prev, [savingKey]: true }));

    try {
       const points = rule.points * value;
       const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
       const logEntry: Omit<DailyAchievementLog, 'id'> = {
         agentId: agentId,
         podId: selectedPodId,
         competitionId: activeCompetitionId,
         ruleId: rule.id!,
         ruleName: rule.name,
         date: dateTimestamp,
         value: value,
         points: points,
         loggedAt: serverTimestamp() as Timestamp,
         loggedBy: currentUserUid,
       };

       const achievementsRef = collection(db, 'dailyAchievements');
       let docRef;

       if (agentInput.existingLogId) {
         docRef = doc(achievementsRef, agentInput.existingLogId);
         if (value === 0) {
             await deleteDoc(docRef);
             setAchievementInputs(prev => {
                 const newState = { ...prev };
                 if (newState[agentId] && newState[agentId][ruleId]) {
                     newState[agentId][ruleId].existingLogId = undefined;
                 }
                 return newState;
             });
         } else {
            await setDoc(docRef, logEntry, { merge: true });
         }
       } else if (value > 0) {
         const addedDoc = await addDoc(achievementsRef, logEntry);
         setAchievementInputs(prev => {
             const newState = { ...prev };
             if (!newState[agentId]) newState[agentId] = {};
             if (!newState[agentId][ruleId]) newState[agentId][ruleId] = { value: String(value), existingLogId: addedDoc.id };
             else { newState[agentId][ruleId].existingLogId = addedDoc.id; }
             return newState;
         });
       } else if (value === 0 && agentInput.existingLogId) { 
           docRef = doc(achievementsRef, agentInput.existingLogId);
           await deleteDoc(docRef);
           setAchievementInputs(prev => {
               const newState = { ...prev };
               if (newState[agentId] && newState[agentId][ruleId]) {
                   newState[agentId][ruleId].existingLogId = undefined;
               }
               return newState;
           });
       }
    } catch (err) {
      console.error("Error auto-saving achievement:", err);
       toast({ variant: "destructive", title: "Auto-Save Failed", description: `Could not save ${rule.name} for agent.` });
    } finally {
       setIsSaving(prev => ({ ...prev, [savingKey]: false }));
    }
  }, [
    selectedPodId, currentUserUid, activeCompetitionId, competitionRules, achievementInputs, 
    selectedDate, toast
  ]);

  const debouncedInputSave = useDebouncedCallback(handleSaveAchievementCallback, DEBOUNCE_INPUT_SAVE_DELAY);

  const handleInputChange = (agentId: string, ruleId: string, value: string) => {
    setAchievementInputs(prev => ({
      ...prev,
      [agentId]: {
        ...prev[agentId],
        [ruleId]: {
          ...(prev[agentId]?.[ruleId] || { value: '', existingLogId: undefined }),
          value: value,
        },
      },
    }));
     debouncedInputSave(agentId, ruleId, value);
  };


  const canLog = selectedPodId && agents.length > 0 && competitionRules.length > 0 && activeCompetitionId;
  const canSendToTeamsManually = !isLoading && !isSendingToTeams && selectedPodId && pods.find(p => p.id === selectedPodId)?.teamsWebhookUrl && (currentDailyLogsForPod.length > 0 || Object.values(dailyTargets || {}).length > 0);


  return (
    <TooltipProvider>
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
                    <Select
                        onValueChange={handleSelectedPodChange}
                        value={selectedPodId}
                        disabled={isLoadingPods}
                    >
                        <SelectTrigger id="pod-select" className="w-[200px]">
                        <SelectValue placeholder={isLoadingPods ? "Loading..." : "Select Pod"} />
                        </SelectTrigger>
                        <SelectContent>
                        {pods.map(pod => (
                            <SelectItem key={pod.id} value={pod.id}>{pod.name}</SelectItem>
                        ))}
                        {pods.length === 0 && !isLoadingPods && <SelectItem value="-" disabled>No pods found</SelectItem>}
                        </SelectContent>
                    </Select>
                    </div>
                    <div className="grid gap-2">
                    <Label htmlFor="date-select">Date</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            id="date-select"
                            variant={"outline"}
                            className={cn(
                            "w-[200px] justify-start text-left font-normal",
                            !selectedDate && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-50">
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => date && setSelectedDate(startOfDay(date))}
                            initialFocus
                        />
                        </PopoverContent>
                    </Popover>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                        <Switch
                            id="auto-send-teams"
                            checked={autoSendToTeams}
                            onCheckedChange={handleAutoSendToggle}
                            disabled={!selectedPodId || isSendingToTeams}
                        />
                        <Label htmlFor="auto-send-teams" className="text-sm">
                            Auto-send to Teams
                        </Label>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p className="text-xs max-w-xs">If enabled, a summary will be automatically sent to the pod's Teams channel (approx. {DEBOUNCE_SEND_DELAY / 1000}s after last data update from Firestore).</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    <Button
                        onClick={() => sendUpdateToTeamsLogicFn()} 
                        disabled={!canSendToTeamsManually}
                        title={!selectedPodId ? "Select a pod first" : !pods.find(p => p.id === selectedPodId)?.teamsWebhookUrl ? "No webhook URL configured" : (currentDailyLogsForPod.length === 0 && (!dailyTargets || Object.keys(dailyTargets).length === 0)) ? "No data to send" : "Send summary to Teams"}
                    >
                        {isSendingToTeams ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        {isSendingToTeams ? "Sending..." : "Send to Teams"}
                    </Button>
                </div>
            </div>
            </CardContent>
        </Card>

        <Card className="frosted-glass">
            <CardHeader>
            <CardTitle>Log Daily Achievements</CardTitle>
            <CardDescription>Select a pod and date, then enter the achievements for each agent based on the active competition rules.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[calc(100vh-350px)]">
            {error && <p className="text-destructive mb-4">{error}</p>}
            {!selectedPodId ? (
                <p className="text-muted-foreground text-center">Please select a pod to log achievements.</p>
            ) : isLoading ? (
                 <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow>
                            <TableHead className="w-[200px]">Agent</TableHead>
                            <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                            <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                            <TableCell>
                                <div className="flex-1 grid grid-cols-3 gap-4">
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-full" />
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            ) : !canLog && !error ? (
                <p className="text-muted-foreground text-center py-6">
                    {agents.length === 0 ? "No agents found in this pod." : activeCompetitionId === null ? `No competition found associated with ${selectedDate.toLocaleDateString()}.` : "No competition rules found."}
                </p>
                ) : (
                <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                    <TableHead className="w-[200px]">Agent</TableHead>
                    {competitionRules.map(rule => (
                        <TableHead key={rule.id}>
                        {(rule.emoji && rule.emoji.trim() !== '') ? rule.emoji : '❓'} {rule.name} <span className="text-xs text-muted-foreground">({rule.points} pts)</span>
                        </TableHead>
                    ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {agents.map((agent) => (
                    agent.id ? (
                        <TableRow key={agent.id}>
                            <TableCell className="font-medium">{agent.name}</TableCell>
                            {competitionRules.map(rule => (
                            rule.id ? (
                                <TableCell key={rule.id}>
                                    <div className="relative w-24">
                                        <Input
                                            type="number"
                                            min="0"
                                            placeholder="Value"
                                            value={achievementInputs[agent.id!]?.[rule.id!]?.value ?? ''}
                                            onChange={(e) => handleInputChange(agent.id!, rule.id!, e.target.value)}
                                            className="h-8 w-full pr-6"
                                            disabled={isSaving[`${agent.id!}-${rule.id!}`]}
                                            aria-label={`Achievement value for ${agent.name} - ${rule.name}`}
                                        />
                                        {isSaving[`${agent.id!}-${rule.id!}`] && (
                                            <Loader2 className="absolute right-1 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                                        )}
                                    </div>
                                </TableCell>
                            ) : null
                            ))}
                        </TableRow>
                    ) : null
                    ))}
                </TableBody>
                </Table>
                )}
            </CardContent>
        </Card>
        </div>
    </TooltipProvider>
  );
}

