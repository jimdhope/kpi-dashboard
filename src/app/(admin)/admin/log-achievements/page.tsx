
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { CalendarIcon, Loader2, AlertCircle, Filter, Send, Info, UserX, ListTodo } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import type { DailyTask } from '@/app/(admin)/admin/daily-tasks/page';
import { AchievementCard } from '@/components/achievement-card'; // Import the new card

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
  points: number;
  loggedAt: Timestamp;
  loggedBy?: string | null;
  status?: 'absent';
}

// Interface for daily task logs
export interface DailyTaskLog {
  id?: string;
  agentId: string;
  podId: string;
  taskId: string;
  date: Timestamp;
  loggedAt: Timestamp;
  loggedBy?: string | null;
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
  const [competitionRules, setCompetitionRules] = useState<RuleFormData[]>([]);
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [achievementInputs, setAchievementInputs] = useState<AchievementInputState>({});
  const [taskInputs, setTaskInputs] = useState<TaskInputState>({});
  const [isLoadingPods, setIsLoadingPods] = useState(true);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [isLoadingRules, setIsLoadingRules] = useState(false);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(false);
  const [isSaving, setIsSaving] = useState<{ [key: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
  const [activeCompetitionId, setActiveCompetitionId] = useState<string | null>(null);

  const [isManuallySendingTeams, setIsManuallySendingTeams] = useState(false);
  const [dailyTargets, setDailyTargets] = useState<DailyTargetData | null>(null);
  const [currentDailyLogsForPod, setCurrentDailyLogsForPod] = useState<DailyAchievementLog[]>([]);

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
      setCompetitionRules([]);
      setDailyTasks([]);
      setAchievementInputs({});
      setTaskInputs({});
      setActiveCompetitionId(null);
      setDailyTargets(null);
      setCurrentDailyLogsForPod([]);
      setIsLoadingAgents(false);
      setIsLoadingRules(false);
      setIsLoadingInitialData(false);
      return;
    }

    let unsubscribeLogs: Unsubscribe = () => {};
    let unsubscribeTaskLogs: Unsubscribe = () => {};
    let unsubscribeTargets: Unsubscribe = () => {};
    let unsubscribeGlobalTasks: Unsubscribe = () => {};

    const fetchPodDataAndListen = async () => {
      setIsLoadingAgents(true);
      setIsLoadingRules(true);
      setIsLoadingInitialData(true);
      setError(null);
      setAgents([]);
      setCompetitionRules([]);
      setDailyTasks([]);
      setAchievementInputs({});
      setTaskInputs({});
      setActiveCompetitionId(null);
      setDailyTargets(null);
      setCurrentDailyLogsForPod([]);

      // Fetch global daily tasks
      const tasksDocRef = doc(db, 'companyTasks', 'global');
      unsubscribeGlobalTasks = onSnapshot(tasksDocRef, (docSnap) => {
          if (docSnap.exists()) {
              setDailyTasks((docSnap.data()?.tasks || []) as DailyTask[]);
          } else {
              setDailyTasks([]);
          }
      }, (err) => {
          console.error("Error fetching global daily tasks:", err);
          setError("Failed to load daily tasks.");
      });

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
            const taskLogsRef = collection(db, 'dailyTaskLogs');
            const initialTaskLogsQuery = query(
                taskLogsRef,
                where('podId', '==', selectedPodId),
                where('date', '==', dateTimestamp)
            );

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
                        if (!rule.id) return;
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
                const initialTaskInputs: TaskInputState = {};
                fetchedAgents.forEach(agent => {
                    if (!agent.id) return;
                    initialTaskInputs[agent.id] = {};
                    dailyTasks.forEach(task => {
                        if (!task.id) return;
                        const existingLog = logs.find(log => log.agentId === agent.id && log.taskId === task.id);
                        initialTaskInputs[agent.id!][task.id] = {
                            checked: !!existingLog,
                            existingLogId: existingLog?.id,
                        };
                    });
                });
                setTaskInputs(initialTaskInputs);
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
            toast({ variant: "default", title: "No Competition Found", description: `No competition found for this pod. Cannot log achievements.` });
            setIsLoadingRules(false);
            setIsLoadingInitialData(false);
        }
      } catch (err) {
        console.error("Error fetching pod data:", err);
        setError("Failed to load data for the selected pod/date.");
        toast({ variant: "destructive", title: "Error", description: "Could not load agent or competition data." });
        setAgents([]); setCompetitionRules([]); setAchievementInputs({}); setActiveCompetitionId(null);
      } finally {
        if (isLoadingAgents) setIsLoadingAgents(false);
        if (isLoadingRules) setIsLoadingRules(false);
        if (isLoadingInitialData) setIsLoadingInitialData(false);
      }
    };

    fetchPodDataAndListen();
    return () => {
      unsubscribeLogs();
      unsubscribeTaskLogs();
      unsubscribeTargets();
      unsubscribeGlobalTasks();
    };
  }, [selectedPodId, selectedDate]);


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
       const points = rule.points * value;
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
       const existingLogId = achievementInputs[agentId]?.[ruleId]?.existingLogId;

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
    selectedPodId, currentUserUid, activeCompetitionId, competitionRules, achievementInputs,
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

    if (isChecked) {
        const existingLogs = currentDailyLogsForPod.filter(log => log.agentId === agentId && log.status !== 'absent');
        const deletePromises = existingLogs.map(log => log.id ? deleteDoc(doc(achievementsRef, log.id)) : Promise.resolve());
        await Promise.all(deletePromises);

        const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
        const naLogEntry: DailyAchievementLog = {
            agentId,
            podId: selectedPodId,
            competitionId: activeCompetitionId,
            ruleId: 'na', ruleName: 'N/A', date: dateTimestamp,
            value: 0, points: 0,
            loggedAt: serverTimestamp() as Timestamp,
            loggedBy: currentUserUid,
            status: 'absent'
        };
        const addedDoc = await addDoc(achievementsRef, naLogEntry);
        setAchievementInputs(prev => ({
            ...prev,
            [agentId]: { ...prev[agentId], isNA: true, naLogId: addedDoc.id }
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
    setIsSaving(prev => ({ ...prev, [savingKey]: false }));
  };

  const handleTaskChange = async (agentId: string, taskId: string, isChecked: boolean) => {
    if (!selectedPodId || !currentUserUid) {
      toast({ variant: 'destructive', title: 'Cannot save task', description: 'Missing required context (pod or user).' });
      return;
    }

    // Optimistically update the UI first
    setTaskInputs(prev => ({
        ...prev,
        [agentId]: {
            ...prev[agentId],
            [taskId]: {
                ...(prev[agentId]?.[taskId] || { checked: false, existingLogId: undefined }),
                checked: isChecked,
            },
        },
    }));

    const savingKey = `task-${agentId}-${taskId}`;
    setIsSaving(prev => ({ ...prev, [savingKey]: true }));
    const taskLogsRef = collection(db, 'dailyTaskLogs');
    const existingLogId = taskInputs[agentId]?.[taskId]?.existingLogId;

    try {
        if (isChecked) {
            if (existingLogId) {
                console.log("Task already logged.");
            } else {
                const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
                const taskLogEntry: Omit<DailyTaskLog, 'id'> = {
                    agentId,
                    podId: selectedPodId,
                    taskId,
                    date: dateTimestamp,
                    loggedAt: serverTimestamp() as Timestamp,
                    loggedBy: currentUserUid,
                };
                const addedDoc = await addDoc(taskLogsRef, taskLogEntry);
                // Update the state with the new ID from Firestore
                setTaskInputs(prev => ({
                    ...prev,
                    [agentId]: {
                        ...prev[agentId],
                        [taskId]: {
                            ...prev[agentId]?.[taskId],
                            existingLogId: addedDoc.id,
                        },
                    },
                }));
            }
        } else {
            if (existingLogId) {
                await deleteDoc(doc(taskLogsRef, existingLogId));
                // Remove the ID from the state
                setTaskInputs(prev => ({
                    ...prev,
                    [agentId]: {
                        ...prev[agentId],
                        [taskId]: {
                            ...prev[agentId]?.[taskId],
                            existingLogId: undefined,
                        },
                    },
                }));
            }
        }
    } catch (error) {
         console.error("Error saving task log:", error);
         toast({ variant: 'destructive', title: 'Task Save Failed', description: 'Could not save task change.' });
          // Revert the optimistic UI update on error
          setTaskInputs(prev => ({
            ...prev,
            [agentId]: {
                ...prev[agentId],
                [taskId]: {
                    ...prev[agentId]?.[taskId],
                    checked: !isChecked,
                },
            },
        }));
    } finally {
        setIsSaving(prev => ({ ...prev, [savingKey]: false }));
    }
  };

  const handleManualSendToTeams = async () => {
    if (isLoading || !selectedPodId || !activeCompetitionId || !currentUserUid) {
        toast({ variant: "destructive", title: "Cannot Send", description: "Required data is missing or still loading." });
        return;
    }

    const currentPod = pods.find(p => p.id === selectedPodId);
    if (!currentPod || !currentPod.teamsWebhookUrl) {
        toast({ variant: "destructive", title: "Webhook Missing", description: `No Teams webhook URL configured for pod "${currentPod?.name || selectedPodId}".` });
        return;
    }

    if (currentDailyLogsForPod.length === 0 && (!dailyTargets || Object.keys(dailyTargets).length === 0)) {
        toast({ variant: "default", title: "No Data", description: "No achievements or targets to send for today." });
        return;
    }

    setIsManuallySendingTeams(true);

    const agentScoresForTeams: AgentScoreForTeams[] = agents.map(agent => {
        let totalPoints = 0;
        let emojiString = "";
        const agentLogs = currentDailyLogsForPod.filter(log => log.agentId === agent.id);
        const isAbsent = agentLogs.some(log => log.status === 'absent');

        if (isAbsent) {
            return {
                agentFirstName: agent.name.split(' ')[0] || agent.name,
                totalPoints: 0,
                emojiString: "N/A",
                isAbsent: true
            };
        }

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
            .filter(log => log.ruleId === rule.id && log.status !== 'absent')
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

    try {
        await sendTeamsUpdate(
            currentPod.name,
            currentPod.teamsWebhookUrl,
            selectedDate,
            competitionRules,
            agentScoresForTeams,
            podTargetSummaryForTeams
        );
        toast({ title: "Sent to Teams", description: `Summary for ${currentPod.name} sent.` });
    } catch (err: any) {
        console.error("[LogAchievementsPage] Error sending manual Teams update:", err);
        toast({ variant: "destructive", title: "Teams Send Failed", description: err.message || "Could not send update." });
    } finally {
        setIsManuallySendingTeams(false);
    }
};

  const canLog = selectedPodId && agents.length > 0 && (competitionRules.length > 0 || dailyTasks.length > 0);
  const canSendToTeamsManually = !isLoading && !isManuallySendingTeams && selectedPodId && pods.find(p => p.id === selectedPodId)?.teamsWebhookUrl && (currentDailyLogsForPod.length > 0 || Object.values(dailyTargets || {}).length > 0);

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
                <Button
                    onClick={handleManualSendToTeams}
                    disabled={!canSendToTeamsManually || isManuallySendingTeams}
                    title={!selectedPodId ? "Select a pod first" : !pods.find(p => p.id === selectedPodId)?.teamsWebhookUrl ? "No webhook URL configured" : (currentDailyLogsForPod.length === 0 && (!dailyTargets || Object.keys(dailyTargets).length === 0)) ? "No data to send" : "Send summary to Teams"}
                >
                    {isManuallySendingTeams ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    {isManuallySendingTeams ? "Sending..." : "Send to Teams"}
                </Button>
            </div>
        </div>
        </CardContent>
    </Card>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="frosted-glass lg:col-span-2">
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
                        <TableHead key={rule.id}>
                            <span title={rule.name}>{(rule.emoji && rule.emoji.trim() !== '') ? rule.emoji : '❓'} {rule.name}</span>
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
                                <TableCell key={rule.id}>
                                    <AchievementCard
                                        rule={rule}
                                        currentValue={achievementInputs[agent.id!]?.[rule.id!]?.value ?? 0}
                                        isSaving={isSaving[`${agent.id!}-${rule.id!}`] || false}
                                        onIncrement={() => handleValueChange(agent.id!, rule.id!, 1)}
                                        onDecrement={() => handleValueChange(agent.id!, rule.id!, -1)}
                                        disabled={achievementInputs[agent.id!]?.isNA}
                                    />
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

        <Card className="frosted-glass">
             <CardHeader>
                <CardTitle className="flex items-center gap-2"><ListTodo /> Daily Tasks</CardTitle>
                <CardDescription>Check off completed once-a-day tasks for each agent.</CardDescription>
            </CardHeader>
             <CardContent className="overflow-y-auto max-h-[calc(100vh-350px)]">
                 {!selectedPodId ? (
                     <p className="text-muted-foreground text-center">Please select a pod.</p>
                 ) : isLoading ? (
                      <Skeleton className="h-40 w-full" />
                 ) : dailyTasks.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No daily tasks defined.</p>
                 ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Agent</TableHead>
                                {dailyTasks.map(task => (
                                    <TableHead key={task.id} className="text-center">
                                        <span title={task.name}>{task.emoji || '✅'}</span>
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                           {agents.map(agent => (
                               agent.id ? (
                                <TableRow key={agent.id}>
                                    <TableCell className="font-medium">{agent.name}</TableCell>
                                    {dailyTasks.map(task => (
                                        task.id ? (
                                        <TableCell key={task.id} className="text-center">
                                            <Checkbox
                                                id={`task-checkbox-${agent.id}-${task.id}`}
                                                checked={taskInputs[agent.id!]?.[task.id!]?.checked || false}
                                                onCheckedChange={(checked) => handleTaskChange(agent.id!, task.id!, !!checked)}
                                                disabled={isSaving[`task-${agent.id!}-${task.id!}`] || achievementInputs[agent.id!]?.isNA}
                                                aria-label={`Task ${task.name} for ${agent.name}`}
                                             />
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
    </div>
  );
}

