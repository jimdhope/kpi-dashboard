
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
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { CalendarIcon, Loader2, AlertCircle, Filter, Send, Info, UserX, Award, Minus, Plus } from 'lucide-react';
import { format, startOfDay, getDay } from 'date-fns';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { RuleFormData } from '@/models/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { DailyTargetData } from '@/app/(admin)/admin/pod-targets/page';
import { sendTeamsUpdate, type AgentScoreForTeams, type PodTargetSummaryForTeams, type TeamBonusSummary, type TeamTotalScore } from '@/services/teamsWebhook';
import { Checkbox } from '@/components/ui/checkbox';
import { AchievementCard } from '@/components/achievement-card'; // Import the new card
import { Input } from '@/components/ui/input';

// Interface for the data stored in Firestore for achievements
export interface DailyAchievementLog {
  id?: string;
  agentId: string;
  podId: string;
  competitionId: string;
  ruleId: string;
  ruleName: string;
  date: Timestamp;
  value: number;
  loggedAt: Timestamp;
  loggedBy?: string | null;
  status?: 'absent';
  points?: number; // Keep this optional
}

// Interface for daily task logs
export interface DailyTaskLog {
  id?: string;
  agentId: string;
  podId: string;
  competitionId: string; // Added competitionId
  taskId: string;
  date: Timestamp;
  loggedAt: Timestamp;
  loggedBy?: string | null;
}

// Interface for team bonus points
export interface TeamBonusLog {
    id?: string;
    teamId: string;
    podId: string;
    competitionId: string;
    points: number;
    reason: string;
    date: Timestamp;
    loggedAt: Timestamp;
    loggedBy: string;
}

// Interface for managing state within the component
interface AchievementInputState {
  [agentId: string]: {
    [ruleId: string]: {
      value: number; // Changed to number
      existingLogId?: string;
    };
    isNA?: boolean;
    naLogId?: string;
  };
}

interface TaskInputState {
    [agentId: string]: {
        [taskId: string]: {
            checked: boolean;
            existingLogId?: string;
        };
    };
}

interface TeamBonusInputState {
    [teamId: string]: {
        points: number; // Use number for input
        existingLogId?: string; // To track existing log
    };
}

interface Team {
    id: string;
    name: string;
    agentIds: string[];
    emoji?: string;
}


const daysOfWeek = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const LOG_ACHIEVEMENTS_POD_KEY = 'logAchievementsPage_selectedPodId';

// Debounce utility function
const debounce = (func: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout | null = null;
  return (...args: any[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};


export default function AdminLogAchievementsPage() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [teams, setTeams] = useState<Team[]>([]); // Added teams state
  const [competitionRules, setCompetitionRules] = useState<RuleFormData[]>([]);
  const [achievementInputs, setAchievementInputs] = useState<AchievementInputState>({});
  const [taskInputs, setTaskInputs] = useState<TaskInputState>({});
  const [bonusInputs, setBonusInputs] = useState<TeamBonusInputState>({}); // Added bonus points state
  
  const [competitionLogs, setCompetitionLogs] = useState<DailyAchievementLog[]>([]);
  const [competitionBonusLogs, setCompetitionBonusLogs] = useState<TeamBonusLog[]>([]);
  const [dailyTaskLogs, setDailyTaskLogs] = useState<DailyTaskLog[]>([]);
  const [dailyTargets, setDailyTargets] = useState<DailyTargetData | null>(null);

  const [isLoadingPods, setIsLoadingPods] = useState(true);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [isLoadingRules, setIsLoadingRules] = useState(false);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(false);
  const [isSaving, setIsSaving] = useState<{ [key: string]: boolean }>({});
  const [isSavingBonus, setIsSavingBonus] = useState(false);
  const [isSendingToTeams, setIsSendingToTeams] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
  const [activeCompetitionId, setActiveCompetitionId] = useState<string | null>(null);

  const isLoading = isLoadingPods || isLoadingAgents || isLoadingRules || isLoadingInitialData;

  React.useEffect(() => {
    const savedPodId = localStorage.getItem(LOG_ACHIEVEMENTS_POD_KEY);
    if (savedPodId) {
        setSelectedPodId(savedPodId);
    }
  }, []);

  const handleSelectedPodChange = (podId: string) => {
    setSelectedPodId(podId);
    localStorage.setItem(LOG_ACHIEVEMENTS_POD_KEY, podId);
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
      setTeams([]);
      setCompetitionRules([]);
      setAchievementInputs({});
      setTaskInputs({});
      setBonusInputs({});
      setActiveCompetitionId(null);
      setIsLoadingAgents(false);
      setIsLoadingRules(false);
      setIsLoadingInitialData(false);
      return;
    }

    let unsubscribeLogs: Unsubscribe = () => {};
    let unsubscribeTaskLogs: Unsubscribe = () => {};
    let unsubscribeBonusLogs: Unsubscribe = () => {};
    let unsubscribeCompLogs: Unsubscribe = () => {};
    let unsubscribeCompBonusLogs: Unsubscribe = () => {};

    const fetchPodDataAndListen = async () => {
      setIsLoadingAgents(true);
      setIsLoadingRules(true);
      setIsLoadingInitialData(true);
      setError(null);
      setAgents([]);
      setTeams([]);
      setCompetitionRules([]);
      setAchievementInputs({});
      setTaskInputs({});
      setBonusInputs({});
      setActiveCompetitionId(null);

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
            setIsLoadingInitialData(false);
            setActiveCompetitionId(null);
            return;
        }

        const competitionsRef = collection(db, 'competitions');
        const dateForQuery = startOfDay(selectedDate); // Use start of day for comparison
        const competitionQuery = query(
            competitionsRef,
            where('podIds', 'array-contains', selectedPodId),
            orderBy('startDate', 'desc'),
            limit(20)
        );
        const competitionSnapshot = await getDocs(competitionQuery);
        let competitionForLogging: (Competition & { id: string; teams?: Team[] }) | null = null;

        for (const docSnap of competitionSnapshot.docs) {
            const comp = { id: docSnap.id, ...docSnap.data() } as Competition & { id: string; teams?: Team[] };
            const startDate = comp.startDate instanceof Timestamp ? comp.startDate.toDate() : null;
            const endDate = comp.endDate instanceof Timestamp ? comp.endDate.toDate() : null;

            if (startDate && endDate && dateForQuery >= startDate && dateForQuery <= endDate) {
                 competitionForLogging = comp;
                 break;
             }
        }

        if (competitionForLogging) {
            setActiveCompetitionId(competitionForLogging.id);
            setCompetitionRules(competitionForLogging.rules || []);
            setTeams(competitionForLogging.teams?.filter(team => team.agentIds.some(agentId => fetchedAgents.some(agent => agent.id === agentId))) || []);
             setIsLoadingRules(false);

            const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
            const achievementsRef = collection(db, 'dailyAchievements');
            
            // Listener for all logs for the entire competition (for totals)
            const allLogsQuery = query(achievementsRef, where('competitionId', '==', competitionForLogging.id), where('podId', '==', selectedPodId));
            unsubscribeCompLogs = onSnapshot(allLogsQuery, (snapshot) => {
                setCompetitionLogs(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as DailyAchievementLog)));
            });

            // Listener for all bonus logs for the competition
            const bonusLogsRefComp = collection(db, 'teamBonusLogs');
            const bonusLogsQueryComp = query(bonusLogsRefComp, where('podId', '==', selectedPodId), where('competitionId', '==', competitionForLogging.id));
            unsubscribeCompBonusLogs = onSnapshot(bonusLogsQueryComp, (snapshot) => {
                const allBonusLogs = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as TeamBonusLog));
                setCompetitionBonusLogs(allBonusLogs);
            });

            // Listener for just today's logs (for form inputs)
            const initialAchievementsQuery = query(
                achievementsRef,
                where('podId', '==', selectedPodId),
                where('date', '==', dateTimestamp),
                where('competitionId', '==', competitionForLogging.id)
            );
            
            const taskLogsRef = collection(db, 'dailyTaskLogs');
            const initialTaskLogsQuery = query(
                taskLogsRef,
                where('podId', '==', selectedPodId),
                where('date', '==', dateTimestamp),
                 where('competitionId', '==', competitionForLogging.id)
            );

            // Listener for today's bonus logs to populate inputs
            const bonusLogsRef = collection(db, 'teamBonusLogs');
            const todayBonusLogsQuery = query(bonusLogsRef, where('podId', '==', selectedPodId), where('competitionId', '==', competitionForLogging.id), where('date', '==', dateTimestamp));
            unsubscribeBonusLogs = onSnapshot(todayBonusLogsQuery, (snapshot) => {
                const todayBonusLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamBonusLog));
                const initialBonusInputs: TeamBonusInputState = {};
                (competitionForLogging?.teams || []).forEach(team => {
                    const existingLog = todayBonusLogs.find(log => log.teamId === team.id);
                    initialBonusInputs[team.id] = {
                        points: existingLog ? existingLog.points : 0,
                        existingLogId: existingLog?.id,
                    };
                });
                setBonusInputs(initialBonusInputs);
            });
            
            unsubscribeLogs = onSnapshot(initialAchievementsQuery, (snapshot) => {
                const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));

                const initialInputs: AchievementInputState = {};
                fetchedAgents.forEach(agent => {
                    if (!agent.id) return;
                    initialInputs[agent.id] = {};
                    const agentLogs = logs.filter(log => log.agentId === agent.id);
                    const naLog = agentLogs.find(log => log.status === 'absent');
                    initialInputs[agent.id].isNA = !!naLog;
                    initialInputs[agent.id].naLogId = naLog?.id;

                    (competitionForLogging?.rules || []).forEach(rule => {
                        if (!rule.id || rule.type === 'checkbox') return;
                        const existingLog = agentLogs.find(log => log.ruleId === rule.id && log.status !== 'absent');
                        initialInputs[agent.id!][rule.id] = {
                            value: existingLog ? existingLog.value : 0,
                            existingLogId: existingLog?.id,
                        };
                    });
                });
                setAchievementInputs(initialInputs);
            }, (err) => {
                console.error("Error listening to daily logs:", err);
                setError("Failed to load real-time achievement data.");
            });

            unsubscribeTaskLogs = onSnapshot(initialTaskLogsQuery, (snapshot) => {
                const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyTaskLog));
                setDailyTaskLogs(logs);
                const initialTaskInputs: TaskInputState = {};
                fetchedAgents.forEach(agent => {
                    if (!agent.id) return;
                    initialTaskInputs[agent.id] = {};
                     (competitionForLogging?.rules || []).forEach(rule => {
                        if (!rule.id || rule.type !== 'checkbox') return;
                        const existingLog = logs.find(log => log.agentId === agent.id && log.taskId === rule.id);
                        initialTaskInputs[agent.id!][rule.id] = {
                            checked: !!existingLog,
                            existingLogId: existingLog?.id,
                        };
                    });
                });
                setTaskInputs(initialTaskInputs);
            });

             // Fetch targets
             const targetsDocId = `${competitionForLogging.id}_${selectedPodId}`;
             const targetsDocRef = doc(db, 'dailyPodTargets', targetsDocId);
             const targetsDocSnap = await getDoc(targetsDocRef);
             if (targetsDocSnap.exists()) {
                 setDailyTargets(targetsDocSnap.data() as DailyTargetData);
             } else {
                 setDailyTargets(null);
             }


             setIsLoadingInitialData(false);

        } else {
            setActiveCompetitionId(null);
            setCompetitionRules([]);
            toast({ variant: "default", title: "No Competition Found", description: `No competition found for this pod on this date. Cannot log achievements.` });
            setIsLoadingRules(false);
            setIsLoadingInitialData(false);
        }
      } catch (err) {
        console.error("Error fetching pod data:", err);
        setError("Failed to load data for the selected pod/date.");
        toast({ variant: "destructive", title: "Error", description: "Could not load agent or competition data." });
        setAgents([]); setCompetitionRules([]); setAchievementInputs({}); setActiveCompetitionId(null);
        setIsLoadingAgents(false);
        setIsLoadingRules(false);
        setIsLoadingInitialData(false);
      }
    };

    fetchPodDataAndListen();
    return () => {
      unsubscribeLogs();
      unsubscribeTaskLogs();
      unsubscribeBonusLogs();
      unsubscribeCompLogs();
      unsubscribeCompBonusLogs();
    };
  }, [selectedPodId, selectedDate, toast]);


  const handleSaveAchievement = useCallback(async (agentId: string, ruleId: string, value: number) => {
    if (!selectedPodId || !currentUserUid || !activeCompetitionId) {
      console.error("Pod, user, or active competition information missing for auto-save.");
      return;
    }

    const rule = competitionRules.find(r => r.id === ruleId);
    if (!rule || !rule.id) {
       console.error("Rule or input data not found for auto-save. Rule:", rule);
      return;
    }
     const points = value * (rule.points || 0);

     const savingKey = `${agentId}-${ruleId}`;
     setIsSaving(prev => ({ ...prev, [savingKey]: true }));

    try {
       const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
       const logEntry: Omit<DailyAchievementLog, 'id' | 'status'> = {
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
       // Use a function form of setState to get the latest achievementInputs
       let existingLogId: string | undefined;
       setAchievementInputs(currentInputs => {
           existingLogId = currentInputs[agentId]?.[ruleId]?.existingLogId;
           return currentInputs;
       });


       if (existingLogId) {
         const docRef = doc(achievementsRef, existingLogId);
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
             if (!newState[agentId][ruleId]) newState[agentId][ruleId] = { value: value, existingLogId: addedDoc.id };
             else { newState[agentId][ruleId].existingLogId = addedDoc.id; }
             return newState;
         });
       } else if (value === 0 && existingLogId) {
           const docRef = doc(achievementsRef, existingLogId);
           await deleteDoc(docRef);
           setAchievementInputs(prev => {
               const newState = { ...prev };
               if (newState[agentId] && newState[agentId][ruleId]) {
                   newState[agentId][ruleId].existingLogId = undefined;
               }
               return newState;
           });
       }
       console.log(`[LogAchievementsPage] Achievement saved for rule ${rule.id}.`);
    } catch (err) {
      console.error("Error auto-saving achievement:", err);
       toast({ variant: "destructive", title: "Auto-Save Failed", description: `Could not save ${rule.name} for agent.` });
    } finally {
       setIsSaving(prev => ({ ...prev, [savingKey]: false }));
    }
  }, [
    selectedPodId, currentUserUid, activeCompetitionId, competitionRules,
    selectedDate, toast
  ]);

  const debouncedSave = useMemo(() => debounce(handleSaveAchievement, 1000), [handleSaveAchievement]);

  const handleValueChange = useCallback((agentId: string, ruleId: string, change: number) => {
    const currentValue = achievementInputs[agentId]?.[ruleId]?.value ?? 0;
    const newValue = Math.max(0, currentValue + change);

    setAchievementInputs(prev => ({
      ...prev,
      [agentId]: {
        ...prev[agentId],
        [ruleId]: {
          ...(prev[agentId]?.[ruleId] || { value: 0 }),
          value: newValue,
        },
      },
    }));
    debouncedSave(agentId, ruleId, newValue);
  }, [achievementInputs, debouncedSave]);


  const handleNaChange = async (agentId: string, isChecked: boolean) => {
    if (!selectedPodId || !currentUserUid || !activeCompetitionId) {
        toast({ variant: 'destructive', title: 'Cannot set N/A status', description: 'Missing required context (pod, user, or competition).' });
        return;
    }

    const savingKey = `${agentId}-na`;
    setIsSaving(prev => ({ ...prev, [savingKey]: true }));
    const achievementsRef = collection(db, 'dailyAchievements');

    try {
        const batch = writeBatch(db);
        if (isChecked) {
            const initialLogsQuery = query(
                achievementsRef,
                where('agentId', '==', agentId),
                where('podId', '==', selectedPodId),
                where('date', '==', Timestamp.fromDate(startOfDay(selectedDate))),
                where('competitionId', '==', activeCompetitionId),
            );
            const logsToDeleteSnap = await getDocs(initialLogsQuery);
            logsToDeleteSnap.forEach(doc => batch.delete(doc.ref));

            const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
            const naLogEntry: DailyAchievementLog = {
                agentId, podId: selectedPodId, competitionId: activeCompetitionId,
                ruleId: 'na', ruleName: 'N/A', date: dateTimestamp,
                value: 0,
                points: 0,
                loggedAt: serverTimestamp() as Timestamp,
                loggedBy: currentUserUid,
                status: 'absent'
            };
            const newNaLogRef = doc(collection(db, 'dailyAchievements'));
            batch.set(newNaLogRef, naLogEntry);

        } else {
            const naLogId = achievementInputs[agentId]?.naLogId;
            if (naLogId) {
                batch.delete(doc(achievementsRef, naLogId));
            }
        }
        await batch.commit();

        setAchievementInputs(prev => ({
            ...prev,
            [agentId]: { ...prev[agentId], isNA: isChecked, naLogId: isChecked ? (achievementInputs[agentId]?.naLogId || 'temp-id') : undefined }
        }));


    } catch (error) {
         console.error("Error changing N/A status:", error);
         toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update the N/A status.' });
    } finally {
        setIsSaving(prev => ({ ...prev, [savingKey]: false }));
    }
  };

  const handleTaskChange = async (agentId: string, ruleId: string, isChecked: boolean) => {
    if (!selectedPodId || !currentUserUid || !activeCompetitionId) {
      toast({ variant: 'destructive', title: 'Cannot save task', description: 'Missing required context (pod, user, or competition).' });
      return;
    }

    const savingKey = `task-${agentId}-${ruleId}`;
    setIsSaving(prev => ({ ...prev, [savingKey]: true }));

    setTaskInputs(prev => ({
      ...prev,
      [agentId]: { ...prev[agentId], [ruleId]: { ...prev[agentId]?.[ruleId], checked: isChecked } },
    }));

    const taskLogsRef = collection(db, 'dailyTaskLogs');
    const existingLogId = taskInputs[agentId]?.[ruleId]?.existingLogId;

    try {
      if (isChecked) {
        if (!existingLogId) {
          const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
          const taskLogEntry: Omit<DailyTaskLog, 'id'> = {
            agentId, podId: selectedPodId, competitionId: activeCompetitionId,
            taskId: ruleId, date: dateTimestamp,
            loggedAt: serverTimestamp() as Timestamp,
            loggedBy: currentUserUid,
          };
          const addedDoc = await addDoc(taskLogsRef, taskLogEntry);
          setTaskInputs(prev => ({
            ...prev,
            [agentId]: { ...prev[agentId], [ruleId]: { ...prev[agentId]?.[ruleId], existingLogId: addedDoc.id } },
          }));
        }
      } else {
        if (existingLogId) {
          await deleteDoc(doc(taskLogsRef, existingLogId));
          setTaskInputs(prev => ({
            ...prev,
            [agentId]: { ...prev[agentId], [ruleId]: { ...prev[agentId]?.[ruleId], existingLogId: undefined } },
          }));
        }
      }
    } catch (error) {
      console.error("Error saving task log:", error);
      toast({ variant: 'destructive', title: 'Task Save Failed', description: 'Could not save task change.' });
      setTaskInputs(prev => ({
        ...prev,
        [agentId]: { ...prev[agentId], [ruleId]: { ...prev[agentId]?.[ruleId], checked: !isChecked } },
      }));
    } finally {
      setIsSaving(prev => ({...prev, [savingKey]: false}));
    }
  };

    const handleBonusPointsChange = useCallback(async (teamId: string, change: number) => {
        if (!selectedPodId || !currentUserUid || !activeCompetitionId) {
            toast({ variant: "destructive", title: "Cannot Award Points", description: "Missing required context." });
            return;
        }

        const currentPoints = bonusInputs[teamId]?.points ?? 0;
        const newPoints = currentPoints + change; // Can be negative
        const existingLogId = bonusInputs[teamId]?.existingLogId;

        setIsSavingBonus(true);
        setBonusInputs(prev => ({ ...prev, [teamId]: { ...prev[teamId], points: newPoints } }));

        const bonusLogsRef = collection(db, 'teamBonusLogs');
        const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));

        try {
            const logEntry: Omit<TeamBonusLog, 'id'> = {
                teamId, podId: selectedPodId, competitionId: activeCompetitionId,
                points: newPoints, reason: "Manual Adjustment", date: dateTimestamp,
                loggedAt: serverTimestamp() as Timestamp, loggedBy: currentUserUid,
            };

            if (existingLogId) {
                const docRef = doc(bonusLogsRef, existingLogId);
                if (newPoints === 0) {
                    await deleteDoc(docRef);
                    setBonusInputs(prev => ({ ...prev, [teamId]: { ...prev[teamId], existingLogId: undefined } }));
                } else {
                    await updateDoc(docRef, { points: newPoints, loggedAt: serverTimestamp() });
                }
            } else if (newPoints !== 0) {
                const newDocRef = await addDoc(bonusLogsRef, logEntry);
                setBonusInputs(prev => ({ ...prev, [teamId]: { ...prev[teamId], existingLogId: newDocRef.id } }));
            }
             toast({ title: "Bonus Points Updated", description: "Changes saved successfully." });
        } catch (error) {
            console.error("Error saving bonus points:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not save bonus points." });
             // Revert optimistic update on error
             setBonusInputs(prev => ({ ...prev, [teamId]: { ...prev[teamId], points: currentPoints } }));
        } finally {
            setIsSavingBonus(false);
        }
    }, [bonusInputs, selectedPodId, currentUserUid, activeCompetitionId, selectedDate, toast]);


    const handleSendToTeams = async () => {
        const currentPod = pods.find(p => p.id === selectedPodId);
        if (!currentPod || !currentPod.teamsWebhookUrl || !activeCompetitionId) {
            toast({ variant: "destructive", title: "Missing Configuration", description: "No Teams webhook URL or active competition for this pod." });
            return;
        }

        setIsSendingToTeams(true);

        try {
            const todayStart = startOfDay(selectedDate);
            const dayOfWeek = daysOfWeek[getDay(selectedDate)];
            const rulesMap = new Map(competitionRules.map(rule => [rule.id, rule]));
            const numericRules = competitionRules.filter(r => r.type === 'numeric');
            const taskRules = competitionRules.filter(r => r.type === 'checkbox');

            // --- Re-fetch all data required to ensure accuracy at the moment of sending ---
            const achievementsRef = collection(db, 'dailyAchievements');
            const dailyLogsQuery = query(achievementsRef, where('podId', '==', selectedPodId), where('competitionId', '==', activeCompetitionId), where('date', '==', Timestamp.fromDate(todayStart)));
            const dailyLogsSnapshot = await getDocs(dailyLogsQuery);
            const dailyLogsForPod = dailyLogsSnapshot.docs.map(d => d.data() as DailyAchievementLog);

            const taskLogsRef = collection(db, 'dailyTaskLogs');
            const dailyTaskLogsQuery = query(taskLogsRef, where('podId', '==', selectedPodId), where('competitionId', '==', activeCompetitionId), where('date', '==', Timestamp.fromDate(todayStart)));
            const dailyTaskLogsSnapshot = await getDocs(dailyTaskLogsQuery);
            const freshDailyTaskLogs = dailyTaskLogsSnapshot.docs.map(d => d.data() as DailyTaskLog);

            const targetsDocRef = doc(db, 'dailyPodTargets', `${activeCompetitionId}_${selectedPodId}`);
            const targetsDocSnap = await getDoc(targetsDocRef);
            const freshDailyTargets = targetsDocSnap.exists() ? targetsDocSnap.data() as DailyTargetData : null;
            // --- End of fresh data fetch ---


            const absentAgentIds = new Set(dailyLogsForPod.filter(log => log.status === 'absent').map(log => log.agentId));
            const activeAgents = agents.filter(agent => agent.id && !absentAgentIds.has(agent.id));
            
            // 1. Calculate Agent Daily Scores (using fresh dailyLogsForPod)
            const agentScores: AgentScoreForTeams[] = agents.map(agent => {
                if (!agent.id) return null;
                const isAbsent = absentAgentIds.has(agent.id);
                if (isAbsent) {
                    return { agentFirstName: agent.name.split(' ')[0], emojiString: '', totalPoints: 0, isAbsent: true, teamEmoji: teams.find(t => t.agentIds.includes(agent.id!))?.emoji };
                }
                const agentDailyLogs = dailyLogsForPod.filter(l => l.agentId === agent.id);
                const agentDailyTaskLogs = freshDailyTaskLogs.filter(l => l.agentId === agent.id);
                const totalPoints = agentDailyLogs.reduce((acc, log) => acc + ((log.value || 0) * (rulesMap.get(log.ruleId)?.points || 0)), 0);
                const emojiString = numericRules.map(rule => (agentDailyLogs.find(l => l.ruleId === rule.id)?.value || 0) > 0 ? (rule.emoji || '❓').repeat(agentDailyLogs.find(l => l.ruleId === rule.id)!.value) : '').join('');
                const completedTasks = agentDailyTaskLogs.map(taskLog => ({ ruleName: taskRules.find(r => r.id === taskLog.taskId)?.name || 'Task', ruleEmoji: taskRules.find(r => r.id === taskLog.taskId)?.emoji || '✅' }));
                return { agentFirstName: agent.name.split(' ')[0], totalPoints, emojiString, completedTasks, isAbsent: false, teamEmoji: teams.find(t => t.agentIds.includes(agent.id!))?.emoji };
            }).filter((a): a is AgentScoreForTeams => a !== null)
              .sort((a, b) => (agents.find(u => u.name.startsWith(a.agentFirstName))?.name || '').localeCompare(agents.find(u => u.name.startsWith(b.agentFirstName))?.name || ''));

            // 2. Calculate Pod Daily Target Summary (using fresh dailyLogsForPod and freshDailyTargets)
            const podRuleTotalsToday: Record<string, number> = {};
            numericRules.forEach(rule => { if (rule.id) podRuleTotalsToday[rule.id] = 0; });
            dailyLogsForPod.forEach(log => {
                 if (log.ruleId && podRuleTotalsToday.hasOwnProperty(log.ruleId)) {
                     podRuleTotalsToday[log.ruleId] += log.value || 0;
                 }
            });
            const podTargetSummary: PodTargetSummaryForTeams[] = numericRules.map(rule => {
                    const individualTarget = freshDailyTargets?.[rule.id!]?.[dayOfWeek];
                    if (individualTarget === undefined || individualTarget === null || individualTarget < 0) return null;
                    const podTarget = individualTarget * activeAgents.length;
                    const achieved = podRuleTotalsToday[rule.id!] || 0;
                    return { ruleName: rule.name, ruleEmoji: rule.emoji || '❓', achieved, target: podTarget };
                }).filter((s): s is PodTargetSummaryForTeams => s !== null);

            // 3. Calculate Team Competition Scores (using full competitionLogs & competitionBonusLogs from state)
            const teamTotalScores: TeamTotalScore[] = teams.map(team => {
                const teamAgentIds = new Set(team.agentIds);
                const teamCompetitionLogs = competitionLogs.filter(log => teamAgentIds.has(log.agentId));
                const totalPoints = teamCompetitionLogs.reduce((sum, log) => sum + ((log.value || 0) * (rulesMap.get(log.ruleId)?.points || 0)), 0);
                const totalBonusPoints = competitionBonusLogs.filter(b => b.teamId === team.id).reduce((sum, b) => sum + b.points, 0);
                return { teamName: team.name, teamEmoji: team.emoji, totalPoints: totalPoints + totalBonusPoints };
            }).sort((a,b) => b.totalPoints - a.totalPoints);
            
            // 4. Correctly filter for Today's bonus logs only (using competitionBonusLogs from state)
            const dailyBonusLogsForPod = competitionBonusLogs.filter(log => log.date instanceof Timestamp && startOfDay(log.date.toDate()).getTime() === todayStart.getTime());
            const teamBonusSummary: TeamBonusSummary[] = dailyBonusLogsForPod.map(log => ({ teamName: teams.find(t => t.id === log.teamId)?.name || 'Unknown', teamEmoji: teams.find(t => t.id === log.teamId)?.emoji, bonusPoints: log.points }));

          await sendTeamsUpdate(
            currentPod.name,
            currentPod.teamsWebhookUrl,
            selectedDate,
            competitionRules,
            agentScores,
            podTargetSummary,
            freshDailyTaskLogs,
            teamBonusSummary,
            teamTotalScores
          );
          toast({ title: "Sent to Teams", description: "Daily scores summary has been sent." });
        } catch (err: any) {
          console.error("[LogAchievementsPage] Error sending to Teams:", err);
          toast({ variant: "destructive", title: "Send Failed", description: err.message || "Could not send summary to Teams." });
        } finally {
          setIsSendingToTeams(false);
        }
    };


  const canLog = selectedPodId && agents.length > 0 && competitionRules.length > 0;
  const canSendToTeams = !isLoading && canLog && pods.find(p => p.id === selectedPodId)?.teamsWebhookUrl;


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
             <Button onClick={handleSendToTeams} disabled={!canSendToTeams || isSendingToTeams} title={!canSendToTeams ? "Select pod and ensure it has a webhook URL" : ""}>
                 {isSendingToTeams ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                 {isSendingToTeams ? "Sending..." : "Send to Teams"}
             </Button>
        </div>
        </CardContent>
    </Card>

    <div className="space-y-6">
        <Card className="frosted-glass">
            <CardHeader>
            <CardTitle>Log Daily Achievements</CardTitle>
            <CardDescription>Select a pod and date, then enter the achievements for each agent based on the active competition rules.</CardDescription>
            </CardHeader>
            <CardContent>
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
                    {agents.length === 0 ? "No agents found in this pod." : "No competition rules or daily tasks found."}
                </p>
                ) : (
                <div className="overflow-x-auto">
                    <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow>
                        <TableHead className="w-[250px]">Agent</TableHead>
                        {competitionRules.map(rule => (
                            <TableHead key={rule.id} className="w-[120px] text-center">
                                <div className="flex flex-col items-center justify-center gap-1">
                                    <span className="text-lg" title={rule.name}>{(rule.emoji && rule.emoji.trim() !== '') ? rule.emoji : '❓'}</span>
                                    <span className="text-xs font-normal truncate max-w-[100px]">{rule.name}</span>
                                </div>
                            </TableHead>
                        ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {agents.map((agent) => (
                        agent.id ? (
                            <TableRow key={agent.id}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id={`na-checkbox-${agent.id}`}
                                            checked={achievementInputs[agent.id]?.isNA || false}
                                            onCheckedChange={(checked) => handleNaChange(agent.id!, !!checked)}
                                            disabled={isSaving[`${agent.id}-na`]}
                                            aria-label={`Mark ${agent.name} as N/A`}
                                        />
                                        <Label htmlFor={`na-checkbox-${agent.id}`} className={cn(achievementInputs[agent.id]?.isNA && "text-muted-foreground")}>
                                            {agent.name}
                                        </Label>
                                        {isSaving[`${agent.id}-na`] && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                    </div>
                                </TableCell>
                                {competitionRules.map(rule => (
                                rule.id ? (
                                    <TableCell key={rule.id} className="text-center">
                                        {rule.type === 'numeric' ? (
                                            <AchievementCard
                                                rule={rule}
                                                currentValue={achievementInputs[agent.id!]?.[rule.id!]?.value ?? 0}
                                                isSaving={isSaving[`${agent.id!}-${rule.id!}`] || false}
                                                onIncrement={() => handleValueChange(agent.id!, rule.id!, 1)}
                                                onDecrement={() => handleValueChange(agent.id!, rule.id!, -1)}
                                                disabled={achievementInputs[agent.id!]?.isNA}
                                            />
                                        ) : (
                                            <Checkbox
                                                id={`task-checkbox-${agent.id}-${rule.id}`}
                                                checked={taskInputs[agent.id!]?.[rule.id!]?.checked || false}
                                                onCheckedChange={(checked) => handleTaskChange(agent.id!, rule.id!, !!checked)}
                                                disabled={isSaving[`task-${agent.id!}-${rule.id!}`] || achievementInputs[agent.id!]?.isNA}
                                                aria-label={`Task ${rule.name} for ${agent.name}`}
                                            />
                                        )}
                                    </TableCell>
                                ) : null
                                ))}
                            </TableRow>
                        ) : null
                        ))}
                    </TableBody>
                    </Table>
                </div>
                )}
            </CardContent>
        </Card>
        
        {canLog && teams.length > 0 && (
            <Card className="frosted-glass">
                <CardHeader>
                    <CardTitle>Team Bonus Points</CardTitle>
                    <CardDescription>Award or deduct points from teams for the selected day. This affects team leaderboards only.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {teams.map(team => (
                            <Card key={team.id} className="shadow-sm overflow-hidden flex flex-col h-full frosted-glass">
                                <CardHeader className="p-3 pb-0">
                                    <CardTitle className="text-sm font-medium truncate flex items-center gap-2">
                                        <span className="text-lg">{team.emoji || '🏆'}</span>
                                        <span className="truncate" title={team.name}>{team.name}</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-3 flex items-center justify-between flex-grow">
                                    <div className="flex-grow flex items-center justify-center">
                                        <p className="text-2xl font-bold text-primary">{bonusInputs[team.id]?.points ?? 0}</p>
                                    </div>
                                    <div className="flex flex-col border-l ml-3 pl-3">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 rounded-md border-b"
                                            onClick={() => handleBonusPointsChange(team.id, 1)}
                                            disabled={isSavingBonus}
                                            aria-label={`Increase points for ${team.name}`}
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 rounded-md"
                                            onClick={() => handleBonusPointsChange(team.id, -1)}
                                            disabled={isSavingBonus}
                                            aria-label={`Decrease points for ${team.name}`}
                                        >
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </CardContent>
            </Card>
        )}

    </div>
    </div>
  );
}
