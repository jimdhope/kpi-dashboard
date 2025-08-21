
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Leaderboard } from '@/components/leaderboard';
import { Target, CheckSquare, ListChecks, MessageSquare, ListTodo, Trophy } from 'lucide-react'; // Added Trophy
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription as UIDescription } from "@/components/ui/alert";
import { collection, query, where, Timestamp, doc, getDoc, orderBy, onSnapshot, Unsubscribe, setDoc, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { DailyAchievementLog, DailyTaskLog } from '@/app/(admin)/admin/log-achievements/page'; // Import DailyTaskLog
import type { RuleFormData } from '@/models/types';
import type { DailyTargetData } from '@/app/(admin)/admin/pod-targets/page';
import { format, startOfDay, endOfDay, getDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AchievementCard } from '@/components/achievement-card';
import { Progress } from '@/components/ui/progress';
import { MessageOfTheDayDisplay } from '@/components/message-of-the-day-display';
import { AlertCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox'; // Import Checkbox
import { Label } from '@/components/ui/label'; // Import Label
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Import Select components

// Interfaces
interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  rank?: number;
  avatarUrl?: string;
  avatarInitials?: string;
  avatarBgColor?: string;
  emoji?: string;
  isUser?: boolean;
}

interface Team {
  id: string;
  name: string;
  agentIds: string[];
  emoji?: string; // Added emoji
}

interface CompetitionWithRules extends Competition {
    teams?: Team[];
    id: string;
}

interface AgentDailyAchievements {
    totalPoints: number;
    achievements: { ruleId: string; ruleName: string; ruleEmoji: string; value: number, points: number }[];
}

interface AgentCompetitionAchievements {
  totalPoints: number;
  achievements: { ruleId: string; ruleName: string; ruleEmoji: string; value: number, points: number }[];
}


// Updated to include individual and pod targets
interface PodTargetSummary {
  ruleId: string;
  ruleName: string;
  ruleEmoji: string;
  achieved: number;
  individualTarget: number | null;
  podTarget: number | null;
  progress?: number;
}

interface AgentAchievementInputState {
  [ruleId: string]: {
    value: number;
    existingLogId?: string;
  };
}

interface AgentTaskInputState {
    [taskId: string]: {
        checked: boolean;
        existingLogId?: string;
    }
}

// Message of the Day structure from DB
interface MessageOfTheDayDB {
  emoji: string;
  content: string;
  isEnabled: boolean;
  updatedAt: Timestamp;
  updatedBy: string;
}


const daysOfWeek = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const AGENT_DASHBOARD_COMP_KEY = 'agentDashboard_selectedCompetitionId';

export default function AgentDashboardPage() {
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [agentPodId, setAgentPodId] = useState<string | null>(null);
  const [rules, setRules] = useState<RuleFormData[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyAchievementLog[]>([]);
  const [podLogs, setPodLogs] = useState<DailyAchievementLog[]>([]);
  const [dailyTaskLogs, setDailyTaskLogs] = useState<DailyTaskLog[]>([]);
  const [podAgents, setPodAgents] = useState<AppUser[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [dailyTargets, setDailyTargets] = useState<DailyTargetData | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeCompetition, setActiveCompetition] = useState<CompetitionWithRules | null>(null);

  const [allCompetitions, setAllCompetitions] = useState<CompetitionWithRules[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');

  const [achievementInputs, setAchievementInputs] = useState<AgentAchievementInputState>({});
  const [taskInputs, setTaskInputs] = useState<AgentTaskInputState>({});
  const [isSaving, setIsSaving] = useState<{ [key: string]: boolean }>({});

  const [messageOfTheDay, setMessageOfTheDay] = useState<MessageOfTheDayDB | null>(null);
  const [isLoadingMessage, setIsLoadingMessage] = useState(true);

  const listenerRefs = React.useRef<{ [key: string]: Unsubscribe | undefined }>({});

  const cleanupListeners = useCallback((specificListeners?: string[]) => {
    const listenersToClean = specificListeners || Object.keys(listenerRefs.current);
    listenersToClean.forEach(key => {
        if (listenerRefs.current[key]) {
            try {
                listenerRefs.current[key]!();
            } catch (e) {
                console.error(`[AgentDashboard] Error unsubscribing from ${key}:`, e);
            }
            listenerRefs.current[key] = undefined;
        }
    });
    if (!specificListeners) {
        listenerRefs.current = {};
    }
  }, []);

  useEffect(() => {
    setIsLoadingUser(true);
    cleanupListeners(['auth', 'userDoc']);

    listenerRefs.current.auth = auth.onAuthStateChanged(async (user) => {
        cleanupListeners(['userDoc']);
        if (user) {
            const userDocRef = doc(db, 'users', user.uid);
            listenerRefs.current.userDoc = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const userData = { id: docSnap.id, ...docSnap.data() } as AppUser;
                    setCurrentUser(prev => JSON.stringify(prev) !== JSON.stringify(userData) ? userData : prev);
                    const newPodId = userData.podId || null;
                    setAgentPodId(prevPodId => {
                        if (prevPodId !== newPodId) {
                            if (!newPodId) {
                               setError("You are not currently assigned to a pod. Some features may be unavailable.");
                            } else {
                               setError(prevError => (prevError === "You are not currently assigned to a pod. Some features may be unavailable." ? null : prevError));
                            }
                            return newPodId;
                        }
                        return prevPodId;
                    });
                } else {
                    setError("Could not find your user profile data.");
                    setCurrentUser(null); setAgentPodId(null);
                }
                setIsLoadingUser(false);
            }, (err) => {
                setError("Failed to load your profile information.");
                setCurrentUser(null); setAgentPodId(null); setIsLoadingUser(false);
            });
        } else {
            setError("You must be logged in.");
            setCurrentUser(null); setAgentPodId(null); setIsLoadingUser(false);
            cleanupListeners();
            setActiveCompetition(null); setRules([]); setTeams([]); setPodAgents([]);
            setDailyLogs([]); setPodLogs([]); setDailyTargets(null); setAchievementInputs({});
            setDailyTaskLogs([]); setTaskInputs({});
            setIsLoadingData(false);
        }
    });
    return () => {
      cleanupListeners(['auth', 'userDoc']);
    };
  }, [cleanupListeners]);

  useEffect(() => {
    setIsLoadingMessage(true);
    const messageDocRef = doc(db, "messageOfTheDay", "currentMessage");
    const unsubscribeMessage = onSnapshot(messageDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setMessageOfTheDay(docSnap.data() as MessageOfTheDayDB);
      } else {
        setMessageOfTheDay(null);
      }
      setIsLoadingMessage(false);
    }, (error) => {
      toast({ variant: "destructive", title: "Message Error", description: "Could not load message of the day." });
      setIsLoadingMessage(false);
    });
    return () => unsubscribeMessage();
  }, [toast]);

  useEffect(() => {
        let isMounted = true;
        if (isLoadingUser || !agentPodId) {
            if (!isLoadingUser) setIsLoadingData(false);
            return;
        }

        const compQuery = query(collection(db, 'competitions'), where('podIds', 'array-contains', agentPodId), orderBy('startDate', 'desc'));
        const unsubscribeComps = onSnapshot(compQuery, (snapshot) => {
            if (!isMounted) return;
            const fetchedComps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompetitionWithRules));
            setAllCompetitions(fetchedComps);

            const savedCompId = localStorage.getItem(AGENT_DASHBOARD_COMP_KEY);
            if (savedCompId && fetchedComps.some(c => c.id === savedCompId)) {
                setSelectedCompetitionId(savedCompId);
            } else if (fetchedComps.length > 0) {
                const latestActiveComp = fetchedComps.find(c => c.endDate.toDate() >= startOfDay(new Date())) || fetchedComps[0];
                setSelectedCompetitionId(latestActiveComp.id);
            }
        });

        return () => {
            isMounted = false;
            unsubscribeComps();
        };
  }, [isLoadingUser, agentPodId]);


  useEffect(() => {
    let isMounted = true;
    if (isLoadingUser || !agentPodId || !currentUser?.id || !selectedCompetitionId ) {
        if (!isLoadingUser) setIsLoadingData(false);
        setActiveCompetition(null); setRules([]); setTeams([]); setPodAgents([]);
        setDailyLogs([]); setPodLogs([]); setDailyTargets(null); setAchievementInputs({});
        setDailyTaskLogs([]); setTaskInputs({});
        return () => { isMounted = false; cleanupListeners(); };
    }

    setIsLoadingData(true);

    const compDocRef = doc(db, 'competitions', selectedCompetitionId);
    listenerRefs.current.competition = onSnapshot(compDocRef, (compSnap) => {
        if (!isMounted) return;
        if (!compSnap.exists()) {
             setError("Selected competition not found.");
             setActiveCompetition(null);
             setIsLoadingData(false);
             return;
        }
        const newActiveComp = { id: compSnap.id, ...compSnap.data() } as CompetitionWithRules;
        setActiveCompetition(newActiveComp);
        setRules(newActiveComp.rules || []);
        setTeams(newActiveComp.teams || []);

        cleanupListeners(['agents', 'userLogs', 'podLogs', 'targets', 'dailyAchievements', 'userTaskLogs']);
        const usersRef = collection(db, 'users');
        const agentsQuery = query(usersRef, where('podId', '==', agentPodId), where('roles', 'array-contains', 'agent'), orderBy('name'));
        listenerRefs.current.agents = onSnapshot(agentsQuery, (agentsSnapshot) => { if(isMounted) setPodAgents(agentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser))); });

        const achievementsRef = collection(db, 'dailyAchievements');
        const userLogsQuery = query(achievementsRef, where('agentId', '==', currentUser.id), where('podId', '==', agentPodId), where('competitionId', '==', selectedCompetitionId));
        listenerRefs.current.userLogs = onSnapshot(userLogsQuery, (snapshot) => { if (isMounted) setDailyLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DailyAchievementLog))); });

        const podLogsQuery = query(achievementsRef, where('podId', '==', agentPodId), where('competitionId', '==', selectedCompetitionId));
        listenerRefs.current.podLogs = onSnapshot(podLogsQuery, (snapshot) => { if (isMounted) setPodLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DailyAchievementLog))); });

        const targetsDocRef = doc(db, 'dailyPodTargets', `${selectedCompetitionId}_${agentPodId}`);
        listenerRefs.current.targets = onSnapshot(targetsDocRef, (docSnap) => { if (isMounted) setDailyTargets(docSnap.exists() ? docSnap.data() as DailyTargetData : null); });

        const dateTimestamp = Timestamp.fromDate(startOfDay(new Date()));
        const dailyQuery = query(achievementsRef, where('agentId', '==', currentUser.id), where('podId', '==', agentPodId), where('date', '==', dateTimestamp), where('competitionId', '==', selectedCompetitionId));
        listenerRefs.current.dailyAchievements = onSnapshot(dailyQuery, (snapshot) => {
            if (!isMounted) return;
            const existingAchievements = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DailyAchievementLog));
            const initialInputs: AgentAchievementInputState = {};
             (newActiveComp.rules || []).filter(r => r.type === 'numeric').forEach(rule => {
                if (rule.id) {
                    const existingLog = existingAchievements.find(log => log.ruleId === rule.id);
                    initialInputs[rule.id] = { value: existingLog ? existingLog.value : 0, existingLogId: existingLog?.id };
                }
            });
            setAchievementInputs(initialInputs);
        });

        const taskLogsRef = collection(db, 'dailyTaskLogs');
        const userTaskLogsQuery = query(taskLogsRef, where('agentId', '==', currentUser.id), where('date', '==', dateTimestamp), where('competitionId', '==', selectedCompetitionId));
        listenerRefs.current.userTaskLogs = onSnapshot(userTaskLogsQuery, (snapshot) => {
            if (!isMounted) return;
            const tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DailyTaskLog));
            setDailyTaskLogs(tasks);
            const initialTaskInputs: AgentTaskInputState = {};
             (newActiveComp.rules || []).filter(r => r.type === 'checkbox').forEach(task => {
                if (task.id) {
                    const existingLog = tasks.find(log => log.taskId === task.id);
                    initialTaskInputs[task.id] = { checked: !!existingLog, existingLogId: existingLog?.id };
                }
            });
            setTaskInputs(initialTaskInputs);
            setIsLoadingData(false);
        }, (e) => { if (isMounted) setIsLoadingData(false); });
    });

    return () => {
        isMounted = false;
        cleanupListeners();
    };
  }, [agentPodId, currentUser?.id, isLoadingUser, cleanupListeners, toast, selectedCompetitionId]);


  const { agentDailyAchievements, agentCompetitionAchievements, podTargetSummary, agentLeaderboard, teamLeaderboard } = useMemo(() => {
    if (isLoadingUser || isLoadingData || !currentUser || !agentPodId || !activeCompetition) {
        return {
            agentDailyAchievements: { totalPoints: 0, achievements: [] },
            agentCompetitionAchievements: { totalPoints: 0, achievements: [] },
            podTargetSummary: [],
            agentLeaderboard: [],
            teamLeaderboard: [],
        };
    }

    const todayStart = startOfDay(new Date());
    const rulesMap = new Map(rules.map(rule => [rule.id, rule]));
    const todayUserLogs = dailyLogs.filter(log => log.date instanceof Timestamp && startOfDay(log.date.toDate()).getTime() === todayStart.getTime());

    let dailyTotalPoints = 0;
    const dailyAchievementsMap = new Map<string, AgentDailyAchievements['achievements'][0]>();
    const displayRules = rules.filter(rule => rule.type === 'numeric');

    todayUserLogs.forEach(log => {
        const rule = rulesMap.get(log.ruleId);
        if (rule?.id) {
            const pointsToAdd = log.points || 0;
            dailyTotalPoints += pointsToAdd;
            const currentRuleData = dailyAchievementsMap.get(rule.id) || { ruleId: rule.id, ruleName: rule.name, ruleEmoji: rule.emoji || '❓', value: 0, points: 0 };
            currentRuleData.value += log.value || 0;
            currentRuleData.points += pointsToAdd;
            dailyAchievementsMap.set(rule.id, currentRuleData);
        }
    });
    const finalAgentDailyAchievements = { totalPoints: dailyTotalPoints, achievements: Array.from(dailyAchievementsMap.values()).sort((a, b) => a.ruleName.localeCompare(b.ruleName)) };

    let competitionTotalPoints = 0;
    const competitionAchievementsMap = new Map<string, AgentCompetitionAchievements['achievements'][0]>();
     dailyLogs.forEach(log => {
        const rule = rulesMap.get(log.ruleId);
        if (rule?.id) {
            const pointsToAdd = log.points || 0;
            competitionTotalPoints += pointsToAdd;
            const currentRuleData = competitionAchievementsMap.get(rule.id) || { ruleId: rule.id, ruleName: rule.name, ruleEmoji: rule.emoji || '❓', value: 0, points: 0 };
            currentRuleData.value += log.value || 0;
            currentRuleData.points += pointsToAdd;
            competitionAchievementsMap.set(rule.id, currentRuleData);
        }
    });
    const finalAgentCompetitionAchievements = { totalPoints: competitionTotalPoints, achievements: Array.from(competitionAchievementsMap.values()).sort((a, b) => a.ruleName.localeCompare(b.ruleName)) };

    const dayOfWeek = daysOfWeek[getDay(new Date())];
    const podRuleTotalsToday: Record<string, number> = {};
    const todayPodLogs = podLogs.filter(log => log.date instanceof Timestamp && startOfDay(log.date.toDate()).getTime() === todayStart.getTime());
    displayRules.forEach(rule => { if (rule.id) podRuleTotalsToday[rule.id] = 0; });
    todayPodLogs.forEach(log => {
        if (log.ruleId && podRuleTotalsToday.hasOwnProperty(log.ruleId)) {
            podRuleTotalsToday[log.ruleId] += log.value || 0;
        }
     });

    const finalPodTargetSummary: PodTargetSummary[] = displayRules
      .map(rule => {
          if (!rule.id) return null;
          const individualTarget = dailyTargets?.[rule.id]?.[dayOfWeek];
          if (individualTarget === undefined || individualTarget === null || individualTarget < 0) return null;

          const podTarget = podAgents.length > 0 ? individualTarget * podAgents.length : null;
          const achieved = podRuleTotalsToday[rule.id] || 0;
          const progress = podTarget && podTarget > 0 ? Math.min(100, Math.round((achieved / podTarget) * 100)) : (achieved > 0 ? 100 : 0);
          
          return {
              ruleId: rule.id,
              ruleName: rule.name,
              ruleEmoji: rule.emoji || '❓',
              achieved: achieved,
              individualTarget: individualTarget,
              podTarget: podTarget,
              progress: progress
          };
      })
      .filter((item): item is PodTargetSummary => item !== null)
      .sort((a, b) => a.ruleName.localeCompare(b.ruleName));
    
    // Leaderboard logic
    const agentScores: Record<string, number> = {};
    podAgents.forEach(agent => { if(agent.id) agentScores[agent.id] = 0; });

    podLogs.forEach(log => {
        const points = log.points ?? (log.value || 0) * (rulesMap.get(log.ruleId)?.points || 0);
        if (agentScores.hasOwnProperty(log.agentId)) {
            agentScores[log.agentId] += points;
        }
    });

     const teamScores: Record<string, number> = {};
     teams.forEach(team => { teamScores[team.id] = 0; });
 
     podLogs.forEach(log => {
        const points = log.points ?? (log.value || 0) * (rulesMap.get(log.ruleId)?.points || 0);
        const agentTeam = teams.find(team => team.agentIds?.includes(log.agentId));
        if (agentTeam && teamScores.hasOwnProperty(agentTeam.id)) {
            teamScores[agentTeam.id] += points;
        }
     });

    const assignDenseRanks = <T extends { score: number }>(items: T[]): (T & { rank: number })[] => {
        if (items.length === 0) return [];
        const sortedItems = [...items].sort((a, b) => b.score - a.score);
        const scoreRankMap = new Map<number, number>();
        let rankCounter = 1;
        for (const item of sortedItems) {
            if (!scoreRankMap.has(item.score)) {
                scoreRankMap.set(item.score, rankCounter++);
            }
        }
        return sortedItems.map(item => ({...item, rank: scoreRankMap.get(item.score)!}));
    };

    const finalAgentLeaderboard = assignDenseRanks(podAgents.map(agent => ({ id: agent.id!, name: agent.name, score: agentScores[agent.id!] || 0, avatarUrl: agent.avatarUrl, avatarInitials: agent.avatarInitials, avatarBgColor: agent.avatarBgColor, isUser: agent.id === currentUser?.id, })));
    const finalTeamLeaderboard = assignDenseRanks(teams.map(team => ({ id: team.id, name: team.name, score: teamScores[team.id] || 0, emoji: team.emoji, isUser: team.agentIds?.includes(currentUser?.id || '') })));

    return { agentDailyAchievements: finalAgentDailyAchievements, agentCompetitionAchievements: finalAgentCompetitionAchievements, podTargetSummary: finalPodTargetSummary, agentLeaderboard: finalAgentLeaderboard, teamLeaderboard: finalTeamLeaderboard };
  }, [isLoadingUser, isLoadingData, currentUser, agentPodId, activeCompetition, dailyLogs, podLogs, rules, dailyTargets, podAgents, teams]);


  const debounce = useCallback((func: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout | null = null;
    return (...args: any[]) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  }, []);

  const handleSaveAchievement = useCallback(async (ruleId: string, value: number) => {
    if (!agentPodId || !currentUser?.id || !activeCompetition?.id) {
      toast({ variant: "destructive", title: "Save Error", description: "Could not determine user, pod, or competition." });
      return;
    }
    const rule = rules.find(r => r.id === ruleId);
    if (!rule?.id) {
         toast({ variant: "destructive", title: "Save Error", description: "Rule definition not found." });
         return;
    }
    setIsSaving(prev => ({ ...prev, [ruleId]: true }));
    try {
      const points = rule.points * value;
      const dateTimestamp = Timestamp.fromDate(startOfDay(new Date()));
      const logEntry: Omit<DailyAchievementLog, 'id'> = { agentId: currentUser.id, podId: agentPodId, competitionId: activeCompetition.id, ruleId: rule.id, ruleName: rule.name, date: dateTimestamp, value: value, points: points, loggedAt: serverTimestamp() as Timestamp, loggedBy: currentUser.uid };
      const achievementsRef = collection(db, 'dailyAchievements');
      const existingLogId = achievementInputs[ruleId]?.existingLogId;
      if (existingLogId) {
        const docRef = doc(achievementsRef, existingLogId);
         if (value > 0) await setDoc(docRef, logEntry, { merge: true });
         else {
            await deleteDoc(docRef);
            setAchievementInputs(prev => ({ ...prev, [ruleId]: { ...prev[ruleId], value: 0, existingLogId: undefined } }));
         }
      } else if (value > 0) {
        const addedDoc = await addDoc(achievementsRef, logEntry);
        setAchievementInputs(prev => ({ ...prev, [ruleId]: { ...prev[ruleId], existingLogId: addedDoc.id } }));
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Save Failed", description: `Could not save ${rule.name}.` });
    } finally {
      setIsSaving(prev => ({ ...prev, [ruleId]: false }));
    }
  }, [agentPodId, currentUser, activeCompetition?.id, rules, achievementInputs, toast]);

  const debouncedSave = useMemo(() => debounce(handleSaveAchievement, 1000), [handleSaveAchievement, debounce]);

  const handleValueChange = useCallback((ruleId: string, change: number) => {
    const currentValue = achievementInputs[ruleId]?.value ?? 0;
    const newValue = Math.max(0, currentValue + change);
    setAchievementInputs(prev => ({ ...prev, [ruleId]: { ...(prev[ruleId] || { value: 0 }), value: newValue } }));
    debouncedSave(ruleId, newValue);
  }, [achievementInputs, debouncedSave]);

  const handleTaskChange = async (taskId: string, checked: boolean) => {
    if (!agentPodId || !currentUser?.id || !activeCompetition?.id) return;
    const task = rules.find(t => t.id === taskId)!;
    const savingKey = `task-${taskId}`;
    setTaskInputs(prev => ({ ...prev, [taskId]: { ...prev[taskId], checked } }));
    setIsSaving(prev => ({ ...prev, [savingKey]: true }));
    const taskLogsRef = collection(db, 'dailyTaskLogs');
    const existingLogId = taskInputs[taskId]?.existingLogId;
    if (checked) {
      if (existingLogId) { setIsSaving(prev => ({...prev, [savingKey]: false })); return; }
      const newLog: Omit<DailyTaskLog, 'id'> = { agentId: currentUser.id, podId: agentPodId, taskId: task.id!, date: Timestamp.fromDate(startOfDay(new Date())), loggedAt: serverTimestamp() as Timestamp, loggedBy: currentUser.uid, competitionId: activeCompetition.id };
      const addedDoc = await addDoc(taskLogsRef, newLog);
      setTaskInputs(prev => ({...prev, [taskId]: {checked: true, existingLogId: addedDoc.id}}));
    } else {
      if (existingLogId) {
        await deleteDoc(doc(taskLogsRef, existingLogId));
        setTaskInputs(prev => ({...prev, [taskId]: {checked: false, existingLogId: undefined}}));
      }
    }
    setIsSaving(prev => ({...prev, [savingKey]: false}));
  };

  const isLoading = isLoadingUser || isLoadingData || isLoadingMessage;
  const numericRules = useMemo(() => rules.filter(r => r.type === 'numeric'), [rules]);
  const canLog = !isLoading && currentUser && agentPodId && rules.length > 0 && activeCompetition;
  const competitionName = allCompetitions.find(c => c.id === selectedCompetitionId)?.name;

  return (
    <div className="space-y-6">
        {error && !error.startsWith("No active competition") && (
            <Alert variant="destructive" className="mb-6 frosted-glass"><AlertCircle className="h-4 w-4" /><UIDescription>{error}</UIDescription></Alert>
        )}
        <MessageOfTheDayDisplay emoji={messageOfTheDay?.emoji || null} content={messageOfTheDay?.isEnabled ? messageOfTheDay.content : null} isLoading={isLoadingMessage} />
        
        <Card className="w-full frosted-glass">
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div><CardTitle className="flex items-center gap-2"><CheckSquare className="h-5 w-5"/>Today&apos;s Achievements</CardTitle></div>
                <div className="text-right">{isLoading ? <Skeleton className="h-6 w-16 rounded mt-1"/> : <p className="text-2xl font-bold text-primary">{agentDailyAchievements?.totalPoints.toLocaleString() ?? 0} pts</p>}</div>
            </CardHeader>
            <CardContent>
                {isLoading ? <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, index) => (<Skeleton key={`log-skeleton-${index}`} className="h-[120px] w-full" />))}</div>
                : !canLog && !error && !isLoadingUser && !agentPodId ? <p className="text-muted-foreground text-center py-6">You are not assigned to a pod. Please contact your manager.</p>
                : !canLog && !error && numericRules.length === 0 ? <p className="text-muted-foreground text-center py-6">No numerical achievements to log for your pod today.</p>
                : <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {numericRules.map((rule) => rule.id ? <AchievementCard key={rule.id} rule={rule} currentValue={achievementInputs[rule.id]?.value ?? 0} isSaving={isSaving[rule.id] || false} onIncrement={() => handleValueChange(rule.id!, 1)} onDecrement={() => handleValueChange(rule.id!, -1)} /> : null)}
                </div>}
            </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
                <Card className="frosted-glass shadow-md">
                    <CardHeader><CardTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5"/>Your Scores</CardTitle><CardDescription>Your total scores for the currently selected competition.</CardDescription></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary mb-2">{agentCompetitionAchievements?.totalPoints.toLocaleString() ?? 0} pts</div>
                        {isLoading ? <div className="space-y-2"><Skeleton className="h-4 w-full rounded mb-1" /><Skeleton className="h-4 w-5/6 rounded mb-1" /><Skeleton className="h-4 w-3/4 rounded" /></div>
                        : agentCompetitionAchievements?.achievements.length > 0 ? <div className="space-y-1 text-sm">{agentCompetitionAchievements.achievements.map(ach => <div key={ach.ruleId} className="flex items-center justify-between whitespace-nowrap"><span className="font-medium truncate" title={ach.ruleName}>{ach.ruleEmoji} {ach.ruleName}</span><span className="text-muted-foreground">{ach.value.toLocaleString()} ({ach.points.toLocaleString()} pts)</span></div>)}</div>
                        : !error && !isLoading && activeCompetition ? <p className="text-sm text-muted-foreground text-center pt-4">No achievements logged yet for this competition.</p> : null }
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-2 space-y-6">
                <Card className="frosted-glass shadow-md">
                    <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5"/> Pod Targets Today</CardTitle><CardDescription>Your pod&apos;s progress towards today&apos;s targets.</CardDescription></CardHeader>
                    <CardContent>
                        {isLoading ? <div className="space-y-3"><Skeleton className="h-6 w-full rounded mb-2" /><Skeleton className="h-6 w-5/6 rounded mb-2" /><Skeleton className="h-6 w-3/4 rounded" /></div>
                        : podTargetSummary.length > 0 ? <div className="space-y-3">{podTargetSummary.map(summary => <div key={summary.ruleId}><div className="flex items-center justify-between text-sm mb-1"><span className="font-medium truncate" title={summary.ruleName}>{summary.ruleEmoji} {summary.ruleName}</span><span className={cn("font-semibold", summary.progress !== undefined && summary.progress >= 100 ? "text-green-600" : "text-muted-foreground")}>{summary.achieved.toLocaleString()} / {summary.podTarget?.toLocaleString()}</span></div><Progress value={summary.progress ?? 0} className="h-2" /><p className="text-xs text-muted-foreground mt-1">Individual Target: {summary.individualTarget?.toLocaleString()}</p></div>)}</div>
                        : !error && !isLoading && activeCompetition ? <p className="text-muted-foreground text-sm text-center pt-4">No targets set for your pod today.</p> : null }
                    </CardContent>
                </Card>
            </div>
        </div>

        <Card className="mt-6 frosted-glass">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5"/>Competition Leaderboards</CardTitle>
                    <div className="grid gap-2 max-w-sm">
                        <Select
                        onValueChange={(value) => {
                            setSelectedCompetitionId(value);
                            localStorage.setItem(AGENT_DASHBOARD_COMP_KEY, value);
                        }}
                        value={selectedCompetitionId}
                        disabled={isLoading || allCompetitions.length === 0}
                        >
                        <SelectTrigger id="competition-select" className="h-8 text-xs">
                            <SelectValue placeholder={isLoading ? "Loading..." : "Select Competition"} />
                        </SelectTrigger>
                        <SelectContent>
                            {allCompetitions.map(comp => (
                            <SelectItem key={comp.id} value={comp.id}>{comp.name}</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                    </div>
                </div>
                 <CardDescription>{`Showing overall standings for competition: ${competitionName || '...'}`}</CardDescription>
            </CardHeader>
            <CardContent>
                 {isLoadingData ? (
                    <div className="grid md:grid-cols-2 gap-6">
                        <Skeleton className="h-[300px] w-full" />
                        <Skeleton className="h-[300px] w-full" />
                    </div>
                ) : !selectedCompetitionId ? (
                    <p className="text-muted-foreground text-center py-4">Please select a competition to view the leaderboards.</p>
                ) : (
                    <div className="grid md:grid-cols-2 gap-6">
                        <Leaderboard
                            title="Agent Leaderboard"
                            entries={agentLeaderboard}
                            isStickyHeader={false}
                        />
                        <Leaderboard
                            title="Team Leaderboard"
                            entries={teamLeaderboard}
                            isStickyHeader={false}
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    </div>
  );
}

