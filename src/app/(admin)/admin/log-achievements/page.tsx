
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
import { sendTeamsUpdate, type AgentScoreForTeams, type PodTargetSummaryForTeams, type SimpleTaskLog, type TeamBonusSummary, type TeamTotalScore } from '@/services/teamsWebhook';
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
        points: string; // Use string for input
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
  const [isLoadingPods, setIsLoadingPods] = useState(true);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [isLoadingRules, setIsLoadingRules] = useState(false);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(false);
  const [isSaving, setIsSaving] = useState<{ [key: string]: boolean }>({});
  const [isSavingBonus, setIsSavingBonus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
  const [activeCompetitionId, setActiveCompetitionId] = useState<string | null>(null);

  const [isManuallySendingTeams, setIsManuallySendingTeams] = useState(false);
  const [dailyTargets, setDailyTargets] = useState<DailyTargetData | null>(null);
  const [currentDailyLogsForPod, setCurrentDailyLogsForPod] = useState<DailyAchievementLog[]>([]);
  const [currentDailyTaskLogsForPod, setCurrentDailyTaskLogsForPod] = useState<DailyTaskLog[]>([]);
  const [currentDailyBonusLogsForPod, setCurrentDailyBonusLogsForPod] = useState<TeamBonusLog[]>([]);
  const [allCompetitionLogs, setAllCompetitionLogs] = useState<DailyAchievementLog[]>([]);
  const [allCompetitionBonusLogs, setAllCompetitionBonusLogs] = useState<TeamBonusLog[]>([]);

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
      setDailyTargets(null);
      setCurrentDailyLogsForPod([]);
      setCurrentDailyTaskLogsForPod([]);
      setCurrentDailyBonusLogsForPod([]);
      setAllCompetitionLogs([]);
      setAllCompetitionBonusLogs([]);
      setIsLoadingAgents(false);
      setIsLoadingRules(false);
      setIsLoadingInitialData(false);
      return;
    }

    let unsubscribeLogs: Unsubscribe = () => {};
    let unsubscribeTaskLogs: Unsubscribe = () => {};
    let unsubscribeBonusLogs: Unsubscribe = () => {};
    let unsubscribeTargets: Unsubscribe = () => {};
    let unsubscribeAllCompLogs: Unsubscribe = () => {};
    let unsubscribeAllBonusLogs: Unsubscribe = () => {};

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
      setDailyTargets(null);
      setCurrentDailyLogsForPod([]);
      setCurrentDailyTaskLogsForPod([]);
      setCurrentDailyBonusLogsForPod([]);
      setAllCompetitionLogs([]);
      setAllCompetitionBonusLogs([]);

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
            
            const bonusLogsRef = collection(db, 'teamBonusLogs');
            const initialBonusLogsQuery = query(bonusLogsRef, where('podId', '==', selectedPodId), where('competitionId', '==', competitionForLogging.id), where('date', '==', dateTimestamp));
            
            unsubscribeLogs = onSnapshot(initialAchievementsQuery, (snapshot) => {
                const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
                setCurrentDailyLogsForPod(logs);

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
                setCurrentDailyTaskLogsForPod(logs);
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
            
            unsubscribeBonusLogs = onSnapshot(initialBonusLogsQuery, (snapshot) => {
                const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamBonusLog));
                setCurrentDailyBonusLogsForPod(logs);
            });

            // Listeners for ALL competition logs
            const allCompLogsQuery = query(achievementsRef, where('podId', '==', selectedPodId), where('competitionId', '==', competitionForLogging.id));
            unsubscribeAllCompLogs = onSnapshot(allCompLogsQuery, (snapshot) => {
                const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
                setAllCompetitionLogs(logs);
            });

            const allBonusLogsQuery = query(bonusLogsRef, where('podId', '==', selectedPodId), where('competitionId', '==', competitionForLogging.id));
            unsubscribeAllBonusLogs = onSnapshot(allBonusLogsQuery, (snapshot) => {
                const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamBonusLog));
                setAllCompetitionBonusLogs(logs);
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
      unsubscribeTargets();
      unsubscribeAllCompLogs();
      unsubscribeAllBonusLogs();
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
        if (isChecked) {
            const batch = writeBatch(db);
            const existingLogs = currentDailyLogsForPod.filter(log => log.agentId === agentId && log.status !== 'absent');
            existingLogs.forEach(log => {
                if(log.id) batch.delete(doc(achievementsRef, log.id));
            });

            const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
            const naLogEntry: DailyAchievementLog = {
                agentId, podId: selectedPodId, competitionId: activeCompetitionId,
                ruleId: 'na', ruleName: 'N/A', date: dateTimestamp,
                value: 0,
                loggedAt: serverTimestamp() as Timestamp,
                loggedBy: currentUserUid,
                status: 'absent'
            };
            const newNaLogRef = doc(collection(db, 'dailyAchievements'));
            batch.set(newNaLogRef, naLogEntry);
            await batch.commit();

            setAchievementInputs(prev => ({
                ...prev,
                [agentId]: { ...prev[agentId], isNA: true, naLogId: newNaLogRef.id }
            }));

        } else {
            const naLogId = achievementInputs[agentId]?.naLogId;
            if (naLogId) {
                await deleteDoc(doc(achievementsRef, naLogId));
                setAchievementInputs(prev => ({
                    ...prev,
                    [agentId]: { ...prev[agentId], isNA: false, naLogId: undefined }
                }));
            }
        }
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
      setIsSaving(prev => ({ ...prev, [savingKey]: false }));
    }
  };

  const handleBonusInputChange = (teamId: string, value: string) => {
    setBonusInputs(prev => ({...prev, [teamId]: {...prev[teamId], points: value}}));
  };
  
  const handleSaveBonusPoints = async () => {
    if (!selectedPodId || !currentUserUid || !activeCompetitionId) {
        toast({ variant: "destructive", title: "Cannot Award Points", description: "Missing required context." });
        return;
    }

    setIsSavingBonus(true);
    const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
    const bonusLogsRef = collection(db, 'teamBonusLogs');
    const batch = writeBatch(db);

    const logsToProcess = Object.entries(bonusInputs).map(([teamId, data]) => ({
        teamId,
        points: parseInt(data.points, 10) || 0,
    })).filter(log => log.points !== 0);

    if (logsToProcess.length === 0) {
        toast({ title: "No bonus points to award." });
        setIsSavingBonus(false);
        return;
    }

    try {
        const q = query(bonusLogsRef, where('podId', '==', selectedPodId), where('competitionId', '==', activeCompetitionId), where('date', '==', dateTimestamp));
        const snapshot = await getDocs(q);
        const existingLogsMap = new Map(snapshot.docs.map(doc => [doc.data().teamId, doc.id]));

        for (const { teamId, points } of logsToProcess) {
            const existingLogId = existingLogsMap.get(teamId);
            const logEntry: Omit<TeamBonusLog, 'id'> = {
                teamId, podId: selectedPodId, competitionId: activeCompetitionId,
                points, reason: "Manual Adjustment", date: dateTimestamp,
                loggedAt: serverTimestamp() as Timestamp, loggedBy: currentUserUid,
            };
            const docRef = existingLogId ? doc(bonusLogsRef, existingLogId) : doc(bonusLogsRef);
            batch.set(docRef, logEntry);
        }

        await batch.commit();
        toast({ title: "Success", description: "Team bonus points have been awarded." });
        setBonusInputs({}); 
    } catch (error) {
        console.error("Error saving bonus points:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not save bonus points." });
    } finally {
        setIsSavingBonus(false);
    }
  };

    const { agentScores, teamBonusSummary, teamTotalScores } = useMemo(() => {
        const dayOfWeek = daysOfWeek[getDay(selectedDate)];
        const rulesMap = new Map(competitionRules.map(rule => [rule.id, rule]));

        const dailyAgentScores: AgentScoreForTeams[] = agents.map(agent => {
            if (!agent.id) return null;
            const agentDailyLogs = currentDailyLogsForPod.filter(log => log.agentId === agent.id);
            const isAbsent = agentDailyLogs.some(log => log.status === 'absent');
            if (isAbsent) {
                return { agentId: agent.id, agentFirstName: agent.name.split(' ')[0], totalPoints: 0, emojiString: '', isAbsent: true, completedTasks: [], teamEmoji: undefined, targetProgress: '' };
            }

            let totalPoints = 0;
            let emojiString = '';
            const numericRules = competitionRules.filter(r => r.type === 'numeric').sort((a,b) => a.name.localeCompare(b.name));

            numericRules.forEach(rule => {
                if (!rule.id) return;
                const log = agentDailyLogs.find(l => l.ruleId === rule.id);
                if (log && log.value > 0) {
                    totalPoints += (log.value || 0) * (rule.points || 0);
                    const emoji = (rule.emoji && rule.emoji.trim() !== '') ? rule.emoji : '❓';
                    emojiString += emoji.repeat(log.value);
                }
            });
            const targetProgressParts = numericRules.map(rule => {
                if (!rule.id) return null;
                const target = dailyTargets?.[rule.id]?.[dayOfWeek];
                if (target === undefined || target === null || target < 0) return null;
                const achieved = agentDailyLogs.find(log => log.ruleId === rule.id)?.value || 0;
                return `${rule.emoji || '❓'} ${achieved}/${target}`;
            }).filter(Boolean);

            const agentTaskLogs = currentDailyTaskLogsForPod.filter(log => log.agentId === agent.id);
            const completedTasks = agentTaskLogs.map(taskLog => {
                const rule = competitionRules.find(r => r.id === taskLog.taskId && r.type === 'checkbox');
                return { ruleName: rule?.name || 'Unknown Task', ruleEmoji: (rule?.emoji && rule.emoji.trim() !== '') ? rule.emoji : '✅' };
            });

            const agentTeam = teams.find(team => team.agentIds?.includes(agent.id!));
            return {
                agentId: agent.id,
                agentFirstName: agent.name.split(' ')[0],
                totalPoints,
                emojiString,
                isAbsent: false,
                completedTasks,
                teamEmoji: agentTeam?.emoji,
                targetProgress: targetProgressParts.join(' | ')
            };
        }).filter((a): a is AgentScoreForTeams => a !== null)
          .sort((a, b) => a.agentFirstName.localeCompare(b.agentFirstName));

        const dailyTeamBonusSummary: TeamBonusSummary[] = teams.map(team => {
            const bonus = currentDailyBonusLogsForPod.filter(log => log.teamId === team.id).reduce((acc, log) => acc + log.points, 0);
            return { teamName: team.name, teamEmoji: team.emoji, bonusPoints: bonus };
        }).filter(summary => summary.bonusPoints !== 0);

        const teamTotalScoresMap: { [teamId: string]: number } = {};
        teams.forEach(team => teamTotalScoresMap[team.id] = 0);
        allCompetitionLogs.forEach(log => {
            const rule = rulesMap.get(log.ruleId);
            if (rule) {
                const agentTeam = teams.find(team => team.agentIds?.includes(log.agentId));
                if (agentTeam) {
                    const points = (log.value || 0) * (rule.points || 0);
                    teamTotalScoresMap[agentTeam.id] = (teamTotalScoresMap[agentTeam.id] || 0) + points;
                }
            }
        });
        allCompetitionBonusLogs.forEach(log => {
            if(teamTotalScoresMap.hasOwnProperty(log.teamId)) {
                teamTotalScoresMap[log.teamId] += log.points || 0;
            }
        });

        const finalTeamTotalScores = teams.map(team => ({
            teamName: team.name,
            teamEmoji: team.emoji,
            totalPoints: teamTotalScoresMap[team.id] || 0
        })).sort((a,b) => b.totalPoints - a.totalPoints);

        return { agentScores: dailyAgentScores, teamBonusSummary: dailyTeamBonusSummary, teamTotalScores: finalTeamTotalScores };
    }, [agents, competitionRules, currentDailyLogsForPod, currentDailyTaskLogsForPod, currentDailyBonusLogsForPod, dailyTargets, selectedDate, teams, allCompetitionLogs, allCompetitionBonusLogs]);

    const handleSendToTeams = async () => {
        const currentPod = pods.find(p => p.id === selectedPodId);
        if (!currentPod || !currentPod.teamsWebhookUrl) {
            toast({ variant: "destructive", title: "Missing Webhook", description: "No Teams webhook URL configured for this pod." });
            return;
        }
        if (agentScores.length === 0 && teamBonusSummary.length === 0) {
            toast({ variant: "default", title: "No Data", description: "Nothing to send to Teams for this day." });
            return;
        }
        setIsManuallySendingTeams(true);
        try {
            await sendTeamsUpdate(
                currentPod.name,
                currentPod.teamsWebhookUrl,
                selectedDate,
                competitionRules,
                agentScores,
                [], // podTargetSummaryForTeams - not needed here
                currentDailyTaskLogsForPod,
                teamBonusSummary,
                teamTotalScores
            );
            toast({ title: "Sent to Teams", description: "Daily scores summary has been sent." });
        } catch (err: any) {
            console.error("Error sending to Teams from log page:", err);
            toast({ variant: "destructive", title: "Send Failed", description: err.message || "Could not send summary to Teams." });
        } finally {
            setIsManuallySendingTeams(false);
        }
    };


  const canLog = selectedPodId && agents.length > 0 && competitionRules.length > 0;
  const canSendToTeamsManually = !isLoading && !isManuallySendingTeams && selectedPodId && pods.find(p => p.id === selectedPodId)?.teamsWebhookUrl && (currentDailyLogsForPod.length > 0 || currentDailyTaskLogsForPod.length > 0 || currentDailyBonusLogsForPod.length > 0);

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
            <div className="flex items-center gap-4">
                 <Button onClick={handleSendToTeams} disabled={!canSendToTeamsManually}>
                    {isManuallySendingTeams ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                    Send to Teams
                </Button>
            </div>
        </div>
        </CardContent>
    </Card>

    <div className="space-y-6">
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
                    {agents.length === 0 ? "No agents found in this pod." : "No competition rules or daily tasks found."}
                </p>
                ) : (
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
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                           {teams.map(team => (
                               <div key={team.id} className="flex items-center gap-3">
                                   <Label htmlFor={`bonus-${team.id}`} className="flex-1 text-sm font-medium">
                                       <span className="text-lg mr-2">{team.emoji || '🏆'}</span>
                                       {team.name}
                                   </Label>
                                   <Input
                                       id={`bonus-${team.id}`}
                                       type="number"
                                       placeholder="0"
                                       className="w-24"
                                       value={bonusInputs[team.id]?.points ?? ''}
                                       onChange={(e) => handleBonusInputChange(team.id, e.target.value)}
                                       disabled={isSavingBonus}
                                   />
                               </div>
                           ))}
                        </div>
                         <div className="flex justify-end">
                            <Button onClick={handleSaveBonusPoints} disabled={isSavingBonus}>
                                {isSavingBonus ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Award className="mr-2 h-4 w-4"/>}
                                Award Bonus Points
                            </Button>
                         </div>
                    </div>
                </CardContent>
            </Card>
        )}

    </div>
    </div>
  );
}

    
