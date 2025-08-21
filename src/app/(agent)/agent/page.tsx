
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Leaderboard } from '@/components/leaderboard';
import { Target, CheckSquare, ListChecks, MessageSquare, ListTodo } from 'lucide-react'; // Added ListTodo
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

// Interfaces
interface LeaderboardEntry {
  id: string;
  name: string;
  totalPoints: number;
  rank?: number;
  avatarUrl?: string;
  avatarInitials?: string;
  avatarBgColor?: string;
  isCurrentUser?: boolean;
  isCurrentUserTeam?: boolean;
  score: number;
}

interface Team {
  id: string;
  name: string;
  agentIds: string[];
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


interface PodTargetSummary {
  ruleId: string;
  ruleName: string;
  ruleEmoji: string;
  achieved: number;
  target: number | null;
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

const getMedalColor = (rank: number) => {
    switch (rank) {
        case 1: return 'text-yellow-400';
        case 2: return 'text-gray-300';
        case 3: return 'text-orange-400';
        default: return 'text-muted-foreground';
    }
};
const getRankHighlightStyle = (rank: number): React.CSSProperties => {
    switch (rank) {
        case 1: return { backgroundColor: '#9f8f5e', color: '#ffffff' };
        case 2: return { backgroundColor: '#969696', color: '#ffffff' };
        case 3: return { backgroundColor: '#996b4f', color: '#ffffff' };
        default: return {};
    }
};

const assignDenseRanks = <T extends { score: number }>(items: T[]): (T & { rank: number })[] => {
    if (!Array.isArray(items) || items.length === 0) {
        return [];
    }
    const sortedItems = [...items].sort((a, b) => (b.score || 0) - (a.score || 0));
    const scoreRankMap = new Map<number, number>();
    let rankCounter = 1;
    for (const item of sortedItems) {
        const score = typeof item.score === 'number' && !isNaN(item.score) ? item.score : 0;
        if (!scoreRankMap.has(score)) {
            scoreRankMap.set(score, rankCounter++);
        }
    }
    return sortedItems.map(item => {
        const score = typeof item.score === 'number' && !isNaN(item.score) ? item.score : 0;
        const rank = scoreRankMap.get(score)!;
        return {
            ...item,
            rank: rank
        };
    });
};


export default function AgentDashboardPage() {
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [agentPodId, setAgentPodId] = useState<string | null>(null);
  const [rules, setRules] = useState<RuleFormData[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyAchievementLog[]>([]);
  const [podLogs, setPodLogs] = useState<DailyAchievementLog[]>([]);
  const [dailyTaskLogs, setDailyTaskLogs] = useState<DailyTaskLog[]>([]); // New state for task logs
  const [podAgents, setPodAgents] = useState<AppUser[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [dailyTargets, setDailyTargets] = useState<DailyTargetData | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeCompetition, setActiveCompetition] = useState<CompetitionWithRules | null>(null);

  const [achievementInputs, setAchievementInputs] = useState<AgentAchievementInputState>({});
  const [taskInputs, setTaskInputs] = useState<AgentTaskInputState>({}); // New state for task inputs
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
    if (isLoadingUser || !agentPodId || !currentUser?.id ) {
        cleanupListeners(['agents', 'competition', 'userLogs', 'podLogs', 'targets', 'dailyAchievements', 'userTaskLogs']);
        if (!isLoadingUser) {
             setIsLoadingData(false);
             setActiveCompetition(null); setRules([]); setTeams([]); setPodAgents([]);
             setDailyLogs([]); setPodLogs([]); setDailyTargets(null); setAchievementInputs({});
             setDailyTaskLogs([]); setTaskInputs({});
        }
        return () => { isMounted = false; cleanupListeners(); };
    }

    setIsLoadingData(true);

    const usersRef = collection(db, 'users');
    const agentsQuery = query(usersRef, where('podId', '==', agentPodId), where('roles', 'array-contains', 'agent'), orderBy('name'));
    cleanupListeners(['agents']);
    listenerRefs.current.agents = onSnapshot(agentsQuery, (agentsSnapshot) => {
        if (!isMounted) return;
        const fetchedAgents = agentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
        setPodAgents(currentAgents => JSON.stringify(currentAgents) !== JSON.stringify(fetchedAgents) ? fetchedAgents : currentAgents);
    });

    const competitionsRef = collection(db, 'competitions');
    const todayStart = startOfDay(new Date());
    const competitionQuery = query(
        competitionsRef,
        where('podIds', 'array-contains', agentPodId),
        where('startDate', '<=', Timestamp.fromDate(todayStart)),
        orderBy('startDate', 'desc')
    );
    cleanupListeners(['competition']);
    listenerRefs.current.competition = onSnapshot(competitionQuery, (competitionSnapshot) => {
        if (!isMounted) return;
        let foundActiveCompetition: CompetitionWithRules | null = null;
        for (const docSnap of competitionSnapshot.docs) {
            const comp = { id: docSnap.id, ...docSnap.data() } as CompetitionWithRules;
            if (comp.endDate && comp.endDate instanceof Timestamp && endOfDay(comp.endDate.toDate()) >= todayStart) {
                foundActiveCompetition = comp;
                break;
            }
        }

        setActiveCompetition(currentActiveComp => {
            const newActiveCompId = foundActiveCompetition?.id || null;
            const currentActiveCompId = currentActiveComp?.id || null;
            if (newActiveCompId !== currentActiveCompId) {
                cleanupListeners(['userLogs', 'podLogs', 'targets', 'dailyAchievements', 'userTaskLogs']);
                setRules([]); setTeams([]); setDailyLogs([]); setPodLogs([]); setDailyTargets(null); setAchievementInputs({});
                setDailyTaskLogs([]); setTaskInputs({});
                if (foundActiveCompetition) {
                    const activeCompId = foundActiveCompetition.id;
                    setRules((foundActiveCompetition.rules || []));
                    setTeams(foundActiveCompetition.teams || []);
                    const achievementsRef = collection(db, 'dailyAchievements');
                    const compStartDate = foundActiveCompetition.startDate;
                    if (!(compStartDate instanceof Timestamp)) {
                        setError("Invalid competition start date found."); setIsLoadingData(false); return foundActiveCompetition;
                    }
                    const userLogsQuery = query(achievementsRef, where('agentId', '==', currentUser.id), where('podId', '==', agentPodId), where('competitionId', '==', activeCompId), where('date', '>=', compStartDate));
                    listenerRefs.current.userLogs = onSnapshot(userLogsQuery, (snapshot) => { if (isMounted) setDailyLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DailyAchievementLog))); });
                    const podLogsQuery = query(achievementsRef, where('podId', '==', agentPodId), where('competitionId', '==', activeCompId), where('date', '>=', compStartDate));
                    listenerRefs.current.podLogs = onSnapshot(podLogsQuery, (snapshot) => { if (isMounted) setPodLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DailyAchievementLog))); });
                    const targetsDocId = `${activeCompId}_${agentPodId}`;
                    const targetsDocRef = doc(db, 'dailyPodTargets', targetsDocId);
                    listenerRefs.current.targets = onSnapshot(targetsDocRef, (docSnap) => { if (isMounted) setDailyTargets(docSnap.exists() ? docSnap.data() as DailyTargetData : null); });

                    const dateTimestamp = Timestamp.fromDate(startOfDay(new Date()));
                    const dailyQuery = query(achievementsRef, where('agentId', '==', currentUser.id), where('podId', '==', agentPodId), where('date', '==', dateTimestamp), where('competitionId', '==', activeCompId));
                    listenerRefs.current.dailyAchievements = onSnapshot(dailyQuery, (snapshot) => {
                        if (!isMounted) return;
                        const existingAchievements = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DailyAchievementLog));
                        const initialInputs: AgentAchievementInputState = {};
                        setRules(currentRules => {
                            currentRules.filter(r => r.type === 'numeric').forEach(rule => {
                                if (rule.id) {
                                    const existingLog = existingAchievements.find(log => log.ruleId === rule.id);
                                    initialInputs[rule.id] = { value: existingLog ? existingLog.value : 0, existingLogId: existingLog?.id };
                                }
                            });
                            return currentRules;
                        });
                        setAchievementInputs(initialInputs);
                    }, (e) => { if (isMounted) { console.error(e); }});

                    const taskLogsRef = collection(db, 'dailyTaskLogs');
                    const userTaskLogsQuery = query(taskLogsRef, where('agentId', '==', currentUser.id), where('date', '==', dateTimestamp), where('competitionId', '==', activeCompId));
                    listenerRefs.current.userTaskLogs = onSnapshot(userTaskLogsQuery, (snapshot) => {
                        if (!isMounted) return;
                        const tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DailyTaskLog));
                        setDailyTaskLogs(tasks);
                        const initialTaskInputs: AgentTaskInputState = {};
                        setRules(currentRules => {
                            currentRules.filter(r => r.type === 'checkbox').forEach(task => {
                                if (task.id) {
                                    const existingLog = tasks.find(log => log.taskId === task.id);
                                    initialTaskInputs[task.id] = { checked: !!existingLog, existingLogId: existingLog?.id };
                                }
                            });
                            return currentRules;
                        });
                        setTaskInputs(initialTaskInputs);
                        setIsLoadingData(false);
                    }, (e) => { if (isMounted) { console.error(e); setIsLoadingData(false); }});
                } else {
                     setError(prevError => prevError?.startsWith("You are not") ? prevError : "No active competition found for your pod today.");
                     setIsLoadingData(false);
                }
                return foundActiveCompetition;
            }
            if (isLoadingData && currentActiveComp === foundActiveCompetition) setIsLoadingData(false);
            return currentActiveComp;
        });
    }, (err) => {
        if (isMounted) { setError("Failed to load competition data."); setIsLoadingData(false); }
    });

    return () => {
        isMounted = false;
        cleanupListeners();
    };
  }, [agentPodId, currentUser?.id, isLoadingUser, cleanupListeners, toast]);


  const { agentDailyAchievements, agentCompetitionAchievements, podTargetSummary, agentLeaderboard, teamLeaderboard } = useMemo(() => {
    if (isLoadingUser || isLoadingData || !currentUser || !agentPodId || !activeCompetition) {
        return {
            agentDailyAchievements: { totalPoints: 0, achievements: [] },
            agentCompetitionAchievements: { totalPoints: 0, achievements: [] },
            podTargetSummary: [],
            agentLeaderboard: [],
            teamLeaderboard: []
        };
    }

    const todayStart = startOfDay(new Date());
    const todayUserLogs = dailyLogs.filter(log => log.date instanceof Timestamp && startOfDay(log.date.toDate()).getTime() === todayStart.getTime());

    let dailyTotalPoints = 0;
    const dailyAchievementsMap = new Map<string, AgentDailyAchievements['achievements'][0]>();
    const displayRules = rules.filter(rule => rule.type === 'numeric');

    todayUserLogs.forEach(log => {
        const rule = displayRules.find(r => r.id === log.ruleId);
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
        const rule = displayRules.find(r => r.id === log.ruleId);
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
            const targetValue = dailyTargets?.[rule.id]?.[dayOfWeek];
            if (targetValue === undefined || targetValue === null || targetValue < 0) return null;
            const achieved = podRuleTotalsToday[rule.id] || 0;
            const progress = targetValue > 0 ? Math.min(100, Math.round((achieved / targetValue) * 100)) : (achieved > 0 ? 100 : 0);
            return { ruleId: rule.id, ruleName: rule.name, ruleEmoji: rule.emoji || '❓', achieved: achieved, target: targetValue, progress: progress };
        })
        .filter((item): item is PodTargetSummary => item !== null)
        .sort((a, b) => a.ruleName.localeCompare(b.ruleName));

    const agentScoresMap: Record<string, number> = {};
    podAgents.forEach(agent => { if (agent.id) agentScoresMap[agent.id] = 0; });
    podLogs.forEach(log => {
        if (log.agentId && agentScoresMap.hasOwnProperty(log.agentId)) {
            agentScoresMap[log.agentId] += log.points || 0;
        }
    });
    const agentLeaderboardDataPreSort = podAgents.map(agent => ({ id: agent.id!, name: agent.name || 'Unknown Agent', totalPoints: agentScoresMap[agent.id!] || 0, score: agentScoresMap[agent.id!] || 0, avatarUrl: agent.avatarUrl, avatarInitials: agent.avatarInitials, avatarBgColor: agent.avatarBgColor, isCurrentUser: agent.id === currentUser?.id })).filter(item => item.id);
    const finalAgentLeaderboard = assignDenseRanks(agentLeaderboardDataPreSort);

    const teamScoresMap: Record<string, number> = {};
    teams.forEach(team => { if (team.id) teamScoresMap[team.id] = 0; });
    podLogs.forEach(log => {
        const agentTeam = teams.find(team => team.agentIds.includes(log.agentId));
        if (agentTeam?.id) {
            teamScoresMap[agentTeam.id] += log.points || 0;
        }
    });
    const teamLeaderboardDataPreSort = teams.map(team => ({ id: team.id, name: team.name || 'Unknown Team', totalPoints: teamScoresMap[team.id] || 0, score: teamScoresMap[team.id] || 0, isCurrentUserTeam: team.agentIds.includes(currentUser?.id || '') })).filter(item => item.id);
    const finalTeamLeaderboard = assignDenseRanks(teamLeaderboardDataPreSort);

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
  const checkboxRules = useMemo(() => rules.filter(r => r.type === 'checkbox'), [rules]);
  const canLog = !isLoading && currentUser && agentPodId && rules.length > 0 && activeCompetition;

  return (
    <div className="space-y-6">
        {error && !error.startsWith("No active competition") && (
            <Alert variant="destructive" className="mb-6 frosted-glass"><AlertCircle className="h-4 w-4" /><UIDescription>{error}</UIDescription></Alert>
        )}
        <MessageOfTheDayDisplay emoji={messageOfTheDay?.emoji || null} content={messageOfTheDay?.isEnabled ? messageOfTheDay.content : null} isLoading={isLoadingMessage} />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <Card className="frosted-glass">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div><CardTitle className="flex items-center gap-2"><CheckSquare className="h-5 w-5"/>Today&apos;s Achievements</CardTitle></div>
                        <div className="text-right">{isLoading ? <Skeleton className="h-6 w-16 rounded mt-1"/> : <p className="text-2xl font-bold text-primary">{agentDailyAchievements?.totalPoints.toLocaleString() ?? 0} pts</p>}</div>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, index) => (<Skeleton key={`log-skeleton-${index}`} className="h-[130px] w-full" />))}</div>
                        : !canLog && !error && !isLoadingUser && !agentPodId ? <p className="text-muted-foreground text-center py-6">You are not assigned to a pod. Please contact your manager.</p>
                        : !canLog && !error && numericRules.length === 0 ? <p className="text-muted-foreground text-center py-6">No numerical achievements to log for your pod today.</p>
                        : <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {numericRules.map((rule) => rule.id ? <AchievementCard key={rule.id} rule={rule} currentValue={achievementInputs[rule.id]?.value ?? 0} isSaving={isSaving[rule.id] || false} onIncrement={() => handleValueChange(rule.id!, 1)} onDecrement={() => handleValueChange(rule.id!, -1)} /> : null)}
                        </div>}
                    </CardContent>
                </Card>

                <Card className="frosted-glass">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><ListTodo /> Daily Tasks</CardTitle>
                        <CardDescription>Check off your completed one-off tasks for today.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <div className="space-y-3"><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-5/6" /></div>
                        : checkboxRules.length > 0 ? (
                            <div className="space-y-4">
                                {checkboxRules.map(task => (
                                    task.id ? (
                                    <div key={task.id} className="flex items-center space-x-3">
                                        <Checkbox
                                            id={`task-${task.id}`}
                                            checked={taskInputs[task.id]?.checked || false}
                                            onCheckedChange={(checked) => handleTaskChange(task.id!, !!checked)}
                                            disabled={isSaving[`task-${task.id}`]}
                                        />
                                        <Label htmlFor={`task-${task.id}`} className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                           {task.emoji} {task.name}
                                        </Label>
                                         {isSaving[`task-${task.id}`] && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground"/>}
                                    </div>
                                    ) : null
                                ))}
                            </div>
                        ) : (
                             <p className="text-muted-foreground text-sm text-center py-4">No daily tasks assigned today.</p>
                        )}
                    </CardContent>
                </Card>
            </div>

             <div className="lg:col-span-1 space-y-6">
                <Card className="frosted-glass shadow-md flex flex-col h-full">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="flex items-center gap-2"><ListChecks className="h-5 w-5"/><CardTitle>Your Scores</CardTitle></div>
                        <div className="text-right">{isLoading ? <Skeleton className="h-6 w-16 rounded mt-1"/> : <p className="text-2xl font-bold text-primary">{agentCompetitionAchievements?.totalPoints.toLocaleString() ?? 0} pts</p>}</div>
                    </CardHeader>
                    <CardContent className="flex-grow">
                        {isLoading ? <div className="space-y-2"><Skeleton className="h-4 w-full rounded mb-1" /><Skeleton className="h-4 w-5/6 rounded mb-1" /><Skeleton className="h-4 w-3/4 rounded" /></div>
                        : agentCompetitionAchievements?.achievements.length > 0 ? <div className="space-y-1 text-sm">{agentCompetitionAchievements.achievements.map(ach => <div key={ach.ruleId} className="flex items-center justify-between whitespace-nowrap"><span className="font-medium truncate" title={ach.ruleName}>{ach.ruleEmoji} {ach.ruleName}</span><span className="text-muted-foreground">{ach.value.toLocaleString()} ({ach.points.toLocaleString()} pts)</span></div>)}</div>
                        : !error && !isLoading && activeCompetition ? <p className="text-sm text-muted-foreground text-center pt-4">No achievements logged yet for this competition.</p> : null }
                    </CardContent>
                </Card>
                <Card className="frosted-glass shadow-md flex flex-col h-full">
                    <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5"/> Pod Targets Today</CardTitle><CardDescription>Your pod&apos;s progress towards today&apos;s targets.</CardDescription></CardHeader>
                    <CardContent className="flex-grow">
                        {isLoading ? <div className="space-y-3"><Skeleton className="h-6 w-full rounded mb-2" /><Skeleton className="h-6 w-5/6 rounded mb-2" /><Skeleton className="h-6 w-3/4 rounded" /></div>
                        : podTargetSummary.length > 0 ? <div className="space-y-3">{podTargetSummary.map(summary => <div key={summary.ruleId}><div className="flex items-center justify-between text-sm mb-1"><span className="font-medium truncate" title={summary.ruleName}>{summary.ruleEmoji} {summary.ruleName}</span><span className={cn("font-semibold", summary.progress !== undefined && summary.progress >= 100 ? "text-green-600" : "text-muted-foreground")}>{summary.achieved.toLocaleString()} / {summary.target?.toLocaleString()}</span></div><Progress value={summary.progress ?? 0} className="h-2" /></div>)}</div>
                        : !error && !isLoading && activeCompetition ? <p className="text-muted-foreground text-sm text-center pt-4">No targets set for your pod today.</p> : null }
                    </CardContent>
                </Card>
            </div>
        </div>

      <div className="grid gap-6 md:grid-cols-2">
           {isLoading ? (
                <>
                    <Skeleton className="h-[400px] w-full frosted-glass" />
                    <Skeleton className="h-[400px] w-full frosted-glass" />
                </>
           ) : !activeCompetition ? (
                <div className="md:col-span-2">
                    <Card className="h-[100px] flex items-center justify-center shadow-md frosted-glass">
                        <CardContent className="text-muted-foreground text-center">
                            No competition currently active for your pod.
                        </CardContent>
                    </Card>
                </div>
           ) : (
                <>
                    {teamLeaderboard.length > 0 ? (
                        <Leaderboard title="Team Leaderboard" entries={teamLeaderboard} description="Current Competition Ranking" />
                    ) : (
                        <Card className="h-full flex items-center justify-center shadow-md frosted-glass">
                            <CardContent className="text-muted-foreground text-center">No teams configured for this competition.</CardContent>
                        </Card>
                    )}
                     {agentLeaderboard.length > 0 ? (
                        <Leaderboard title="Agent Leaderboard" entries={agentLeaderboard} description="Current Competition Ranking" />
                    ) : (
                        <Card className="h-full flex items-center justify-center shadow-md frosted-glass">
                            <CardContent className="text-muted-foreground text-center">No agent data available for this competition yet.</CardContent>
                        </Card>
                    )}
                </>
           )}
      </div>
    </div>
  );
}

