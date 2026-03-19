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
import { CalendarIcon, Loader2, Send, Filter, Minus, Plus } from 'lucide-react';
import { format, startOfDay, getDay } from 'date-fns';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { RuleFormData } from '@/models/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { DailyTargetData } from '@/app/(admin)/admin/pod-targets/page';
import { sendTeamsUpdate, type AgentScoreForTeams, type PodTargetSummaryForTeams, type TeamBonusSummary, type TeamTotalScore } from '@/services/teamsWebhook';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

interface Competition {
  id: string;
  name: string;
  startDate?: Timestamp;
  endDate?: Timestamp;
  podIds?: string[];
  rules?: Array<{
    id: string;
    name: string;
    emoji?: string;
    points: number;
  }>;
  teams?: Array<{
    id: string;
    name: string;
    agentIds: string[];
    emoji?: string;
  }>;
}

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
  points?: number;
}

export interface DailyTaskLog {
  id?: string;
  agentId: string;
  podId: string;
  competitionId: string;
  taskId: string;
  date: Timestamp;
  loggedAt: Timestamp;
  loggedBy?: string | null;
}

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

interface AchievementInputState {
  [agentId: string]: {
    [ruleId: string]: {
      value: string;
      existingLogId?: string;
    };
    isPresent?: boolean;
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
    points: number;
    existingLogId?: string;
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

const debounce = (func: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout | null = null;
  return (...args: any[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

export default function LogScoresPage() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [competitionRules, setCompetitionRules] = useState<RuleFormData[]>([]);
  const [achievementInputs, setAchievementInputs] = useState<AchievementInputState>({});
  const [taskInputs, setTaskInputs] = useState<TaskInputState>({});
  const [bonusInputs, setBonusInputs] = useState<TeamBonusInputState>({});

  const [competitionLogs, setCompetitionLogs] = useState<DailyAchievementLog[]>([]);
  const [competitionBonusLogs, setCompetitionBonusLogs] = useState<TeamBonusLog[]>([]);

  const [isLoadingPods, setIsLoadingPods] = useState(true);
  const [isLoadingAgentsAndComp, setIsLoadingAgentsAndComp] = useState(false);
  const [isLoadingDailyData, setIsLoadingDailyData] = useState(false);
  const [isSaving, setIsSaving] = useState<{ [key: string]: boolean }>({});
  const [isSavingBonus, setIsSavingBonus] = useState(false);
  const [isSendingToTeams, setIsSendingToTeams] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
  const [activeCompetitionId, setActiveCompetitionId] = useState<string | null>(null);

  const isLoading = isLoadingPods || isLoadingAgentsAndComp || isLoadingDailyData;

  useEffect(() => {
    const savedPodId = localStorage.getItem(LOG_ACHIEVEMENTS_POD_KEY);
    if (savedPodId) setSelectedPodId(savedPodId);
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
      setActiveCompetitionId(null);
      setIsLoadingAgentsAndComp(false);
      return;
    }

    setIsLoadingAgentsAndComp(true);
    setError(null);

    const fetchPodData = async () => {
      try {
        const agentsQuery = query(
          collection(db, 'users'),
          where('podId', '==', selectedPodId),
          where('roles', 'array-contains', 'agent'),
          orderBy('name')
        );
        const agentsSnapshot = await getDocs(agentsQuery);
        const fetchedAgents = agentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
        setAgents(fetchedAgents);

        if (fetchedAgents.length === 0) {
          toast({ variant: "default", title: "No Agents", description: "No users with 'agent' role found in this pod." });
        }

        const dateForQuery = startOfDay(selectedDate);
        const competitionQuery = query(
          collection(db, 'competitions'),
          where('podIds', 'array-contains', selectedPodId)
        );
        const competitionSnapshot = await getDocs(competitionQuery);

        let allPodCompetitions = competitionSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as (Competition & { id: string; teams?: Team[] })));

        allPodCompetitions.sort((a, b) => b.startDate.toDate().getTime() - a.startDate.toDate().getTime());

        let competitionForLogging: (Competition & { id: string; teams?: Team[] }) | null = null;
        for (const comp of allPodCompetitions) {
          const startDate = comp.startDate.toDate();
          const endDate = comp.endDate.toDate();
          if (dateForQuery >= startDate && dateForQuery <= endDate) {
            competitionForLogging = comp;
            break;
          }
        }

        setActiveCompetitionId(competitionForLogging?.id || null);
        setCompetitionRules(competitionForLogging?.rules || []);
        setTeams(competitionForLogging?.teams?.filter(team => team.agentIds.some(agentId => fetchedAgents.some(agent => agent.id === agentId))) || []);

        if (!competitionForLogging) {
          toast({ variant: "default", title: "No Competition Found", description: `No competition found for this pod on this date.` });
        }

      } catch (err) {
        console.error("Error fetching pod data:", err);
        setError("Failed to load data for the selected pod/date.");
      } finally {
        setIsLoadingAgentsAndComp(false);
      }
    };

    fetchPodData();
  }, [selectedPodId, selectedDate, toast]);

  useEffect(() => {
    if (!activeCompetitionId || !selectedPodId || !currentUserUid) {
      setCompetitionLogs([]);
      setCompetitionBonusLogs([]);
      setAchievementInputs({});
      setTaskInputs({});
      setBonusInputs({});
      setIsLoadingDailyData(false);
      return () => {};
    }

    setIsLoadingDailyData(true);
    const unsubscribes: Unsubscribe[] = [];
    const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));

    const allLogsQuery = query(collection(db, 'dailyAchievements'), where('competitionId', '==', activeCompetitionId), where('podId', '==', selectedPodId));
    unsubscribes.push(onSnapshot(allLogsQuery, (snapshot) => {
      setCompetitionLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog)));
    }));

    const allBonusLogsQuery = query(collection(db, 'teamBonusLogs'), where('podId', '==', selectedPodId), where('competitionId', '==', activeCompetitionId));
    unsubscribes.push(onSnapshot(allBonusLogsQuery, (snapshot) => {
      setCompetitionBonusLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamBonusLog)));
    }));

    const dailyAchievementsQuery = query(collection(db, 'dailyAchievements'), where('podId', '==', selectedPodId), where('date', '==', dateTimestamp), where('competitionId', '==', activeCompetitionId));
    unsubscribes.push(onSnapshot(dailyAchievementsQuery, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
      const initialInputs: AchievementInputState = {};
      agents.forEach(agent => {
        if (!agent.id) return;
        initialInputs[agent.id] = {};
        const agentLogs = logs.filter(log => log.agentId === agent.id);
        const naLog = agentLogs.find(log => log.status === 'absent');
        initialInputs[agent.id].isPresent = !naLog;
        initialInputs[agent.id].naLogId = naLog?.id;
        competitionRules.forEach(rule => {
          if (!rule.id || rule.type === 'checkbox') return;
          const existingLog = agentLogs.find(log => log.ruleId === rule.id && log.status !== 'absent');
          initialInputs[agent.id!][rule.id] = { value: existingLog ? String(existingLog.value) : '0', existingLogId: existingLog?.id };
        });
      });
      setAchievementInputs(initialInputs);
      setIsLoadingDailyData(false);
    }));

    const dailyTaskLogsQuery = query(collection(db, 'dailyTaskLogs'), where('podId', '==', selectedPodId), where('date', '==', dateTimestamp), where('competitionId', '==', activeCompetitionId));
    unsubscribes.push(onSnapshot(dailyTaskLogsQuery, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyTaskLog));
      const initialTaskInputs: TaskInputState = {};
      agents.forEach(agent => {
        if (!agent.id) return;
        initialTaskInputs[agent.id] = {};
        competitionRules.forEach(rule => {
          if (!rule.id || rule.type !== 'checkbox') return;
          const existingLog = logs.find(log => log.agentId === agent.id && log.taskId === rule.id);
          initialTaskInputs[agent.id!][rule.id] = { checked: !!existingLog, existingLogId: existingLog?.id };
        });
      });
      setTaskInputs(initialTaskInputs);
    }));

    const todayBonusLogsQuery = query(collection(db, 'teamBonusLogs'), where('podId', '==', selectedPodId), where('competitionId', '==', activeCompetitionId), where('date', '==', dateTimestamp));
    unsubscribes.push(onSnapshot(todayBonusLogsQuery, (snapshot) => {
      const todayBonusLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamBonusLog));
      const initialBonusInputs: TeamBonusInputState = {};
      teams.forEach(team => {
        const existingLog = todayBonusLogs.find(log => log.teamId === team.id);
        initialBonusInputs[team.id] = { points: existingLog ? existingLog.points : 0, existingLogId: existingLog?.id };
      });
      setBonusInputs(initialBonusInputs);
    }));

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [activeCompetitionId, selectedPodId, selectedDate, currentUserUid, agents, competitionRules, teams]);

  const handleSaveAchievement = useCallback(async (agentId: string, ruleId: string, value: string) => {
    if (!selectedPodId || !currentUserUid || !activeCompetitionId) return;

    const rule = competitionRules.find(r => r.id === ruleId);
    if (!rule || !rule.id) return;

    const numericValue = value === '' ? 0 : parseInt(value, 10);
    if (isNaN(numericValue) || numericValue < 0) return;

    const points = numericValue * (rule.points || 0);
    const savingKey = `${agentId}-${ruleId}`;
    setIsSaving(prev => ({ ...prev, [savingKey]: true }));

    try {
      const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
      const logEntry: Omit<DailyAchievementLog, 'id' | 'status'> = {
        agentId: agentId,
        podId: selectedPodId,
        competitionId: activeCompetitionId,
        ruleId: rule.id,
        ruleName: rule.name,
        date: dateTimestamp,
        value: numericValue,
        points: points,
        loggedAt: serverTimestamp() as Timestamp,
        loggedBy: currentUserUid,
      };

      const achievementsRef = collection(db, 'dailyAchievements');
      const logQuery = query(
        achievementsRef,
        where('agentId', '==', agentId),
        where('ruleId', '==', ruleId),
        where('date', '==', dateTimestamp),
        where('competitionId', '==', activeCompetitionId),
        limit(1)
      );
      const logSnapshot = await getDocs(logQuery);
      const existingLogDoc = logSnapshot.docs[0];

      if (existingLogDoc) {
        const docRef = doc(achievementsRef, existingLogDoc.id);
        if (numericValue === 0) {
          await deleteDoc(docRef);
          setAchievementInputs(prev => {
            const newState = { ...prev };
            if (newState[agentId] && newState[agentId][ruleId]) {
              delete newState[agentId][ruleId].existingLogId;
              newState[agentId][ruleId].value = '0';
            }
            return newState;
          });
        } else {
          await setDoc(docRef, logEntry, { merge: true });
        }
      } else if (numericValue > 0) {
        const newDocRef = doc(collection(db, "dailyAchievements"));
        await setDoc(newDocRef, logEntry);
        setAchievementInputs(prev => {
          const newState = { ...prev };
          if (!newState[agentId]) newState[agentId] = {};
          if (!newState[agentId][ruleId]) newState[agentId][ruleId] = { value: String(numericValue), existingLogId: newDocRef.id };
          else { newState[agentId][ruleId].existingLogId = newDocRef.id; }
          return newState;
        });
      }
    } catch (err) {
      console.error("Error auto-saving achievement:", err);
      toast({ variant: "destructive", title: "Auto-Save Failed", description: `Could not save ${rule.name} for agent.` });
    } finally {
      setIsSaving(prev => ({ ...prev, [savingKey]: false }));
    }
  }, [selectedPodId, currentUserUid, activeCompetitionId, competitionRules, selectedDate, toast]);

  const debouncedSave = useMemo(() => debounce(handleSaveAchievement, 1000), [handleSaveAchievement]);

  const handleInputChange = useCallback((agentId: string, ruleId: string, newValue: string) => {
    if (newValue !== '' && (!/^\d*$/.test(newValue))) return;

    setAchievementInputs(prev => ({
      ...prev,
      [agentId]: {
        ...prev[agentId],
        [ruleId]: {
          ...(prev[agentId]?.[ruleId] || { value: '0' }),
          value: newValue,
        },
      },
    }));
    debouncedSave(agentId, ruleId, newValue);
  }, [debouncedSave]);

  const handleIncrement = useCallback((agentId: string, ruleId: string, currentValue: string) => {
    const numericValue = parseInt(currentValue, 10) || 0;
    handleInputChange(agentId, ruleId, String(numericValue + 1));
  }, [handleInputChange]);

  const handleDecrement = useCallback((agentId: string, ruleId: string, currentValue: string) => {
    const numericValue = parseInt(currentValue, 10) || 0;
    if (numericValue > 0) {
      handleInputChange(agentId, ruleId, String(numericValue - 1));
    }
  }, [handleInputChange]);

  const handlePresenceChange = async (agentId: string, isPresent: boolean) => {
    if (!selectedPodId || !currentUserUid || !activeCompetitionId) {
      toast({ variant: 'destructive', title: 'Cannot set presence status', description: 'Missing required context.' });
      return;
    }

    const savingKey = `${agentId}-na`;
    setIsSaving(prev => ({ ...prev, [savingKey]: true }));
    const achievementsRef = collection(db, 'dailyAchievements');

    try {
      const batch = writeBatch(db);
      const naLogId = achievementInputs[agentId]?.naLogId;

      if (!isPresent) {
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
          value: 0, points: 0, loggedAt: serverTimestamp() as Timestamp,
          loggedBy: currentUserUid, status: 'absent'
        };
        const newNaLogRef = doc(collection(db, 'dailyAchievements'));
        batch.set(newNaLogRef, naLogEntry);
      } else {
        if (naLogId) {
          batch.delete(doc(achievementsRef, naLogId));
        }
      }
      await batch.commit();

      setAchievementInputs(prev => ({
        ...prev,
        [agentId]: { ...(prev[agentId] || {}), isPresent: isPresent, naLogId: !isPresent ? (naLogId || 'temp-id') : undefined }
      }));

    } catch (error) {
      console.error("Error changing presence status:", error);
      toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update the presence status.' });
    } finally {
      setIsSaving(prev => ({ ...prev, [savingKey]: false }));
    }
  };

  const handleTaskChange = async (agentId: string, ruleId: string, isChecked: boolean) => {
    if (!selectedPodId || !currentUserUid || !activeCompetitionId) return;

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
      toast({ variant: "destructive", title: "Task Save Failed", description: "Could not save task change." });
      setTaskInputs(prev => ({
        ...prev,
        [agentId]: { ...prev[agentId], [ruleId]: { ...prev[agentId]?.[ruleId], checked: !isChecked } },
      }));
    } finally {
      setIsSaving(prev => ({ ...prev, [savingKey]: false }));
    }
  };

  const handleBonusPointsChange = useCallback(async (teamId: string, change: number) => {
    if (!selectedPodId || !currentUserUid || !activeCompetitionId) return;

    const currentPoints = bonusInputs[teamId]?.points ?? 0;
    const newPoints = currentPoints + change;
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
          await setDoc(docRef, { points: newPoints, loggedAt: serverTimestamp() }, { merge: true });
        }
      } else if (newPoints !== 0) {
        const newDocRef = await addDoc(bonusLogsRef, logEntry);
        setBonusInputs(prev => ({ ...prev, [teamId]: { ...prev[teamId], existingLogId: newDocRef.id } }));
      }
    } catch (error) {
      console.error("Error saving bonus points:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not save bonus points." });
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
      const numericRules = competitionRules.filter(r => r.type === 'numeric');
      const taskRules = competitionRules.filter(r => r.type === 'checkbox');

      const achievementsRef = collection(db, 'dailyAchievements');
      const dailyLogsQuery = query(achievementsRef, where('podId', '==', selectedPodId), where('competitionId', '==', activeCompetitionId), where('date', '==', Timestamp.fromDate(todayStart)));
      const dailyLogsSnapshot = await getDocs(dailyLogsQuery);
      const dailyLogsForPod = dailyLogsSnapshot.docs.map(d => d.data() as DailyAchievementLog);

      const taskLogsRef = collection(db, 'dailyTaskLogs');
      const dailyTaskLogsQuery = query(taskLogsRef, where('podId', '==', selectedPodId), where('competitionId', '==', activeCompetitionId), where('date', '==', Timestamp.fromDate(todayStart)));
      const dailyTaskLogsSnapshot = await getDocs(dailyTaskLogsQuery);
      const freshDailyTaskLogs = dailyTaskLogsSnapshot.docs.map(d => d.data() as DailyTaskLog);

      const absentAgentIds = new Set(dailyLogsForPod.filter(log => log.status === 'absent').map(log => log.agentId));
      const activeAgents = agents.filter(agent => agent.id && !absentAgentIds.has(agent.id));

      const agentScores: AgentScoreForTeams[] = agents.map(agent => {
        if (!agent.id) return null;
        const isAbsent = absentAgentIds.has(agent.id);
        if (isAbsent) {
          return { agentFirstName: agent.name.split(' ')[0], emojiString: '', totalPoints: 0, isAbsent: true, teamEmoji: teams.find(t => t.agentIds.includes(agent.id!))?.emoji };
        }
        const agentDailyLogs = dailyLogsForPod.filter(l => l.agentId === agent.id);
        const agentDailyTaskLogs = freshDailyTaskLogs.filter(l => l.agentId === agent.id);
        const totalPoints = agentDailyLogs.reduce((acc, log) => acc + (log.points ?? 0), 0);
        const emojiString = numericRules.map(rule => (agentDailyLogs.find(l => l.ruleId === rule.id)?.value || 0) > 0 ? (rule.emoji || '❓').repeat(agentDailyLogs.find(l => l.ruleId === rule.id)!.value) : '').join('');
        const completedTasks = agentDailyTaskLogs.map(taskLog => ({ ruleName: taskRules.find(r => r.id === taskLog.taskId)?.name || 'Task', ruleEmoji: taskRules.find(r => r.id === taskLog.taskId)?.emoji || '✅' }));
        return { agentFirstName: agent.name.split(' ')[0], totalPoints, emojiString, completedTasks, isAbsent: false, teamEmoji: teams.find(t => t.agentIds.includes(agent.id!))?.emoji };
      }).filter((a): a is AgentScoreForTeams => a !== null);

      const podRuleTotalsToday: Record<string, number> = {};
      numericRules.forEach(rule => { if (rule.id) podRuleTotalsToday[rule.id] = 0; });
      dailyLogsForPod.forEach(log => {
        if (log.ruleId && podRuleTotalsToday.hasOwnProperty(log.ruleId) && log.status !== 'absent') {
          podRuleTotalsToday[log.ruleId] += log.value || 0;
        }
      });

      const targetsDocRef = doc(db, 'dailyPodTargets', `${activeCompetitionId}_${selectedPodId}`);
      const targetsDocSnap = await getDoc(targetsDocRef);
      const freshDailyTargets = targetsDocSnap.exists() ? targetsDocSnap.data() as DailyTargetData : null;

      const podTargetSummary: PodTargetSummaryForTeams[] = numericRules.map(rule => {
        const individualTarget = freshDailyTargets?.[rule.id!]?.[dayOfWeek];
        if (individualTarget === undefined || individualTarget === null || individualTarget < 0) return null;
        const podTarget = individualTarget * activeAgents.length;
        const achieved = podRuleTotalsToday[rule.id!] || 0;
        return { ruleName: rule.name, ruleEmoji: rule.emoji || '❓', achieved, target: podTarget };
      }).filter((s): s is PodTargetSummaryForTeams => s !== null);

      const dailyBonusLogsForPod = competitionBonusLogs.filter(log => log.date instanceof Timestamp && startOfDay(log.date.toDate()).getTime() === todayStart.getTime());
      const teamBonusSummary: TeamBonusSummary[] = dailyBonusLogsForPod.map(log => ({ teamName: teams.find(t => t.id === log.teamId)?.name || 'Unknown', teamEmoji: teams.find(t => t.id === log.teamId)?.emoji, bonusPoints: log.points }));

      const teamTotalScores: TeamTotalScore[] = teams.map(team => {
        const teamAgentIds = new Set(team.agentIds);
        const teamCompetitionLogs = competitionLogs.filter(log => teamAgentIds.has(log.agentId));
        const totalPoints = teamCompetitionLogs.reduce((sum, log) => sum + (log.points ?? 0), 0);
        const totalBonusPoints = competitionBonusLogs.filter(b => b.teamId === team.id).reduce((sum, b) => sum + b.points, 0);
        return { teamName: team.name, teamEmoji: team.emoji, totalPoints: totalPoints + totalBonusPoints };
      }).sort((a,b) => b.totalPoints - a.totalPoints);

      await sendTeamsUpdate(
        currentPod.name, currentPod.teamsWebhookUrl, selectedDate,
        competitionRules, agentScores, podTargetSummary, freshDailyTaskLogs,
        teamBonusSummary, teamTotalScores
      );
      toast({ title: "Sent to Teams", description: "Daily scores summary has been sent." });
    } catch (err: any) {
      console.error("Error sending to Teams:", err);
      toast({ variant: "destructive", title: "Send Failed", description: err.message || "Could not send summary to Teams." });
    } finally {
      setIsSendingToTeams(false);
    }
  };

  const canLog = selectedPodId && agents.length > 0 && competitionRules.length > 0;
  const canSendToTeams = !isLoading && canLog && pods.find(p => p.id === selectedPodId)?.teamsWebhookUrl;

  const numericRules = useMemo(() => competitionRules.filter(r => r.type !== 'checkbox'), [competitionRules]);
  const checkboxRules = useMemo(() => competitionRules.filter(r => r.type === 'checkbox'), [competitionRules]);

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
                <Select onValueChange={handleSelectedPodChange} value={selectedPodId} disabled={isLoadingPods}>
                  <SelectTrigger id="pod-select" className="w-[200px]">
                    <SelectValue placeholder={isLoadingPods ? "Loading..." : "Select Pod"} />
                  </SelectTrigger>
                  <SelectContent>
                    {pods.map(pod => (
                      <SelectItem key={pod.id} value={pod.id}>{pod.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date-select">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button id="date-select" variant={"outline"} className={cn("w-[200px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50">
                    <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(startOfDay(date))} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <Button onClick={handleSendToTeams} disabled={!canSendToTeams || isSendingToTeams}>
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
            <CardDescription>Select a pod and date, then enter achievements for each agent.</CardDescription>
          </CardHeader>
          <CardContent>
            {error && <p className="text-destructive mb-4">{error}</p>}
            
            {!selectedPodId ? (
              <p className="text-muted-foreground text-center">Please select a pod to log achievements.</p>
            ) : isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : !canLog && !error ? (
              <p className="text-muted-foreground text-center py-6">
                {agents.length === 0 ? "No agents found in this pod." : "No competition rules found."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="sticky left-0 z-10 bg-muted/50 w-[200px]">Agent</TableHead>
                      {competitionRules.map(rule => (
                        <TableHead key={rule.id} className="text-center min-w-[100px]">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-lg">{rule.emoji || '📋'}</span>
                            <span className="text-xs font-normal">{rule.name}</span>
                            <span className="text-[10px] text-muted-foreground">{rule.points} pts</span>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map(agent => {
                      const isPresent = achievementInputs[agent.id!]?.isPresent !== false;
                      const isAbsent = !isPresent;
                      
                      return (
                        <TableRow key={agent.id} className={cn(isAbsent && "opacity-50 bg-muted/30")}>
                          <TableCell className="sticky left-0 z-10 bg-background font-medium">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handlePresenceChange(agent.id!, !isPresent)}
                                className={cn(
                                  "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                                  isPresent ? "border-green-500 bg-green-500/20 text-green-600" : "border-muted-foreground/50",
                                  isSaving[`${agent.id}-na`] && "opacity-50"
                                )}
                                aria-label={`Mark ${agent.name} as ${isPresent ? 'absent' : 'present'}`}
                              >
                                {isPresent && <span className="text-xs">✓</span>}
                              </button>
                              <span className={cn(!isPresent && "line-through text-muted-foreground")}>
                                {agent.name}
                              </span>
                              {isSaving[`${agent.id}-na`] && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                            </div>
                          </TableCell>
                          {competitionRules.map(rule => {
                            if (rule.type === 'checkbox') {
                              return (
                                <TableCell key={rule.id} className="text-center">
                                  <Switch
                                    checked={taskInputs[agent.id!]?.[rule.id!]?.checked || false}
                                    onCheckedChange={(checked) => handleTaskChange(agent.id!, rule.id!, checked)}
                                    disabled={isAbsent || isSaving[`task-${agent.id!}-${rule.id!}`]}
                                    aria-label={`${rule.name} for ${agent.name}`}
                                  />
                                </TableCell>
                              );
                            }
                            
                            return (
                              <TableCell key={rule.id} className="text-center">
                                {isAbsent ? (
                                  <span className="text-muted-foreground">--</span>
                                ) : (
                                  <div className="flex items-center justify-center gap-1">
                                    <Input
                                      type="text"
                                      inputMode="numeric"
                                      value={achievementInputs[agent.id!]?.[rule.id!]?.value ?? '0'}
                                      onChange={(e) => handleInputChange(agent.id!, rule.id!, e.target.value)}
                                      className="w-14 h-8 text-center"
                                      disabled={isSaving[`${agent.id!}-${rule.id!}`]}
                                    />
                                    <div className="flex flex-col">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-4 w-6 text-xs"
                                        onClick={() => handleIncrement(agent.id!, rule.id!, achievementInputs[agent.id!]?.[rule.id!]?.value ?? '0')}
                                        disabled={isSaving[`${agent.id!}-${rule.id!}`]}
                                      >
                                        <Plus className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-4 w-6 text-xs"
                                        onClick={() => handleDecrement(agent.id!, rule.id!, achievementInputs[agent.id!]?.[rule.id!]?.value ?? '0')}
                                        disabled={isSaving[`${agent.id!}-${rule.id!}`] || parseInt(achievementInputs[agent.id!]?.[rule.id!]?.value ?? '0') <= 0}
                                      >
                                        <Minus className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
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
              <CardDescription>Award or deduct points from teams for the selected day.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {teams.map(team => (
                  <Card key={team.id} className="shadow-sm frosted-glass">
                    <CardHeader className="p-3 pb-0">
                      <CardTitle className="text-sm font-medium truncate flex items-center gap-2">
                        <span className="text-lg">{team.emoji || '🏆'}</span>
                        <span className="truncate" title={team.name}>{team.name}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 flex items-center justify-between">
                      <span className="text-2xl font-bold text-primary">{bonusInputs[team.id]?.points ?? 0}</span>
                      <div className="flex flex-col">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-b-none border-b-0"
                          onClick={() => handleBonusPointsChange(team.id, 1)}
                          disabled={isSavingBonus}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-t-none"
                          onClick={() => handleBonusPointsChange(team.id, -1)}
                          disabled={isSavingBonus}
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
