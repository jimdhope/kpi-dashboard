'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Leaderboard } from '@/components/leaderboard';
import { Target, Medal, Trophy, AlertCircle, CheckSquare, ListChecks } from 'lucide-react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription as UIDescription } from "@/components/ui/alert"; // Corrected import
import { collection, query, where, Timestamp, doc, getDoc, orderBy, onSnapshot, Unsubscribe, setDoc, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { DailyAchievementLog } from '@/app/(admin)/admin/log-achievements/page';
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog';
import type { DailyTargetData } from '@/app/(admin)/admin/pod-targets/page';
import { format, startOfDay, endOfDay, getDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AchievementCard } from '@/components/achievement-card';
import { Progress } from '@/components/ui/progress';

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
    teams?: Team[]; // Changed from any[]
    id: string;
}

interface AgentCompetitionAchievements {
  totalPoints: number;
  achievements: { ruleId: string; ruleName: string; ruleEmoji: string; value: number, points: number }[];
}

interface AgentDailyAchievements {
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

const daysOfWeek = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Helper functions for rank styling
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

// Dense Ranking Logic
const assignDenseRanks = <T extends { score: number }>(items: T[]): (T & { rank: number })[] => {
    if (!Array.isArray(items) || items.length === 0) {
        return [];
    }
    const sortedItems = [...items].sort((a, b) => (b.score || 0) - (a.score || 0));
    const scoreRankMap = new Map<number, number>();
    let rankCounter = 1;
    for (const item of sortedItems) {
        const score = typeof item.score === 'number' ? item.score : 0;
        if (!scoreRankMap.has(score)) {
            scoreRankMap.set(score, rankCounter++);
        }
    }
    return sortedItems.map(item => ({
        ...item,
        rank: scoreRankMap.get(typeof item.score === 'number' ? item.score : 0)!,
    }));
};


export default function AgentDashboardPage() {
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [agentPodId, setAgentPodId] = useState<string | null>(null);
  const [rules, setRules] = useState<RuleFormData[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyAchievementLog[]>([]);
  const [podLogs, setPodLogs] = useState<DailyAchievementLog[]>([]);
  const [podAgents, setPodAgents] = useState<AppUser[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [dailyTargets, setDailyTargets] = useState<DailyTargetData | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeCompetition, setActiveCompetition] = useState<CompetitionWithRules | null>(null);

  const [achievementInputs, setAchievementInputs] = useState<AgentAchievementInputState>({});
  const [isSaving, setIsSaving] = useState<{ [key: string]: boolean }>({});

  const listenerRefs = React.useRef<{ [key: string]: Unsubscribe | undefined }>({});

  const cleanupListeners = useCallback((specificListeners?: string[]) => {
    const listenersToClean = specificListeners || Object.keys(listenerRefs.current);
    console.log(`[AgentDashboard] Cleaning up listeners: ${listenersToClean.join(', ')}`);
    listenersToClean.forEach(key => {
        if (listenerRefs.current[key]) {
            try {
                listenerRefs.current[key]!();
                console.log(`[AgentDashboard] Unsubscribed from ${key}`);
            } catch (e) {
                console.error(`[AgentDashboard] Error unsubscribing from ${key}:`, e);
            }
            listenerRefs.current[key] = undefined;
        }
    });
    if (!specificListeners) { // Full cleanup
        listenerRefs.current = {};
    }
  }, []);

  useEffect(() => {
    setIsLoadingUser(true);
    console.log("[AgentDashboard] Setting up auth listener...");
    cleanupListeners(['auth', 'userDoc']);

    listenerRefs.current.auth = auth.onAuthStateChanged(async (user) => {
        cleanupListeners(['userDoc']);
        if (user) {
            console.log(`[AgentDashboard] Auth state changed: User found (UID: ${user.uid})`);
            const userDocRef = doc(db, 'users', user.uid);
            listenerRefs.current.userDoc = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const userData = { id: docSnap.id, ...docSnap.data() } as AppUser;
                    setCurrentUser(prev => JSON.stringify(prev) !== JSON.stringify(userData) ? userData : prev);
                    const newPodId = userData.podId || null;
                    setAgentPodId(prevPodId => {
                        if (prevPodId !== newPodId) {
                            console.log(`[AgentDashboard] Agent Pod ID changed from ${prevPodId} to: ${newPodId}`);
                            if (!newPodId) setError("You are not currently assigned to a pod. Some features may be unavailable.");
                            else setError(prevError => (prevError === "You are not currently assigned to a pod. Some features may be unavailable." ? null : prevError));
                            return newPodId;
                        }
                        return prevPodId;
                    });
                } else {
                    console.error(`[AgentDashboard] User document not found in Firestore for UID: ${user.uid}`);
                    setError("Could not find your user profile data.");
                    setCurrentUser(null); setAgentPodId(null);
                }
                setIsLoadingUser(false);
            }, (err) => {
                console.error("[AgentDashboard] Error listening to user document:", err);
                setError("Failed to load your profile information.");
                setCurrentUser(null); setAgentPodId(null); setIsLoadingUser(false);
            });
        } else {
            console.log("[AgentDashboard] Auth state changed: No user logged in.");
            setError("You must be logged in.");
            setCurrentUser(null); setAgentPodId(null); setIsLoadingUser(false);
        }
    });
    return () => {
      console.log("[AgentDashboard] Cleaning up auth and userDoc listeners on unmount.");
      cleanupListeners(['auth', 'userDoc']);
    };
  }, [cleanupListeners]);

  useEffect(() => {
    let isMounted = true;
    console.log(`[AgentDashboard] Data Effect triggered: isLoadingUser=${isLoadingUser}, agentPodId=${agentPodId}, currentUser=${!!currentUser?.id}`);

    if (isLoadingUser || !agentPodId || !currentUser?.id ) {
        console.log("[AgentDashboard] Data Effect: Skipping/Cleaning up, prerequisites not met.");
        cleanupListeners(['agents', 'competition', 'userLogs', 'podLogs', 'targets', 'dailyAchievements']);
        if (!isLoadingUser) {
             setIsLoadingData(false);
             setActiveCompetition(null); setRules([]); setTeams([]); setPodAgents([]);
             setDailyLogs([]); setPodLogs([]); setDailyTargets(null); setAchievementInputs({});
        }
        return;
    }

    setIsLoadingData(true);
    console.log("[AgentDashboard] Data Effect: Starting data fetch for pod:", agentPodId);

    const usersRef = collection(db, 'users');
    const agentsQuery = query(usersRef, where('podId', '==', agentPodId), where('roles', 'array-contains', 'agent'), orderBy('name'));
    cleanupListeners(['agents']);
    listenerRefs.current.agents = onSnapshot(agentsQuery, (agentsSnapshot) => {
        if (!isMounted) return;
        const fetchedAgents = agentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
        setPodAgents(currentAgents => {
            const currentIds = currentAgents.map(a => a.id).sort().join(',');
            const fetchedIds = fetchedAgents.map(a => a.id).sort().join(',');
            if (currentIds !== fetchedIds) {
                console.log("[AgentDashboard] Pod agents listener updated, found:", fetchedAgents.length);
                return fetchedAgents;
            }
            return currentAgents;
        });
    }, (err) => { if (isMounted) { console.error("[AgentDashboard] Error listening to pod agents:", err); setError("Failed to load pod member data.");}});

    const competitionsRef = collection(db, 'competitions');
    const todayStart = startOfDay(new Date());
    const competitionQuery = query(competitionsRef, where('podIds', 'array-contains', agentPodId), where('startDate', '<=', Timestamp.fromDate(todayStart)), orderBy('startDate', 'desc'));
    cleanupListeners(['competition']);
    listenerRefs.current.competition = onSnapshot(competitionQuery, (competitionSnapshot) => {
        if (!isMounted) return;
        let foundActiveCompetition: CompetitionWithRules | null = null;
        for (const docSnap of competitionSnapshot.docs) {
            const comp = { id: docSnap.id, ...docSnap.data() } as CompetitionWithRules;
            if (comp.endDate && comp.endDate instanceof Timestamp && endOfDay(comp.endDate.toDate()) >= todayStart) {
                foundActiveCompetition = comp; break;
            }
        }

        setActiveCompetition(currentActiveComp => {
            const newActiveCompId = foundActiveCompetition?.id || null;
            const currentActiveCompId = currentActiveComp?.id || null;

            if (newActiveCompId !== currentActiveCompId) {
                console.log(`[AgentDashboard] Active competition changed from ${currentActiveCompId} to: ${newActiveCompId}. Cleaning up dependent listeners.`);
                cleanupListeners(['userLogs', 'podLogs', 'targets', 'dailyAchievements']);
                setRules([]); setTeams([]); setDailyLogs([]); setPodLogs([]); setDailyTargets(null); setAchievementInputs({});

                if (foundActiveCompetition) {
                    const activeCompId = foundActiveCompetition.id;
                    const activeCompRules = (foundActiveCompetition.rules || []).filter(rule => rule.name.toLowerCase() !== 'bonus');
                    setRules(activeCompRules);
                    setTeams(foundActiveCompetition.teams || []);
                    console.log(`[AgentDashboard] Set ${activeCompRules.length} rules and ${foundActiveCompetition.teams?.length ?? 0} teams for competition ${activeCompId}`);

                    const achievementsRef = collection(db, 'dailyAchievements');
                    const compStartDate = foundActiveCompetition.startDate;
                    if (!(compStartDate instanceof Timestamp)) {
                        console.error("[AgentDashboard] Invalid competition start date:", compStartDate);
                        setError("Invalid competition start date found."); setIsLoadingData(false); return foundActiveCompetition;
                    }

                    const userLogsQuery = query(achievementsRef, where('agentId', '==', currentUser.id), where('podId', '==', agentPodId), where('competitionId', '==', activeCompId), where('date', '>=', compStartDate));
                    listenerRefs.current.userLogs = onSnapshot(userLogsQuery, (snapshot) => { if (!isMounted) return; setDailyLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DailyAchievementLog)));}, (e) => { if (isMounted) console.error("[AgentDashboard] Error listening to user logs:", e);});

                    const podLogsQuery = query(achievementsRef, where('podId', '==', agentPodId), where('competitionId', '==', activeCompId), where('date', '>=', compStartDate));
                    listenerRefs.current.podLogs = onSnapshot(podLogsQuery, (snapshot) => { if (!isMounted) return; setPodLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DailyAchievementLog)));}, (e) => { if (isMounted) console.error("[AgentDashboard] Error listening to pod logs:", e);});

                    const targetsDocId = `${activeCompId}_${agentPodId}`;
                    const targetsDocRef = doc(db, 'dailyPodTargets', targetsDocId);
                    listenerRefs.current.targets = onSnapshot(targetsDocRef, (docSnap) => { if (!isMounted) return; setDailyTargets(docSnap.exists() ? docSnap.data() as DailyTargetData : null);}, (e) => { if (isMounted) console.error("[AgentDashboard] Error listening to daily targets:", e);});

                    const dateTimestamp = Timestamp.fromDate(startOfDay(new Date()));
                    const dailyQuery = query(achievementsRef, where('agentId', '==', currentUser.id), where('podId', '==', agentPodId), where('date', '==', dateTimestamp), where('competitionId', '==', activeCompId));
                    listenerRefs.current.dailyAchievements = onSnapshot(dailyQuery, (snapshot) => {
                        if (!isMounted) return;
                        const existingAchievements = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DailyAchievementLog));
                        const initialInputs: AgentAchievementInputState = {};
                        activeCompRules.forEach(rule => {
                            if (!rule.id) return;
                            const existingLog = existingAchievements.find(log => log.ruleId === rule.id);
                            initialInputs[rule.id] = { value: existingLog ? existingLog.value : 0, existingLogId: existingLog?.id };
                        });
                        setAchievementInputs(initialInputs);
                        setIsLoadingData(false);
                    }, (e) => { if (isMounted) { console.error("[AgentDashboard] Error listening to daily achievements:", e); setIsLoadingData(false); }});
                } else {
                     setError(prevError => prevError?.startsWith("You are not") ? prevError : "No active competition found for your pod today.");
                     setIsLoadingData(false);
                }
                return foundActiveCompetition;
            }
            if (isLoadingData) setIsLoadingData(false); // Ensure loading stops if competition didn't change but was already loading
            return currentActiveComp;
        });
    }, (err) => { if (isMounted) { console.error("[AgentDashboard] Error listening to competitions:", err);setError("Failed to load competition data."); setIsLoadingData(false);}});

    return () => { isMounted = false; cleanupListeners(['agents', 'competition', 'userLogs', 'podLogs', 'targets', 'dailyAchievements']); };
  }, [agentPodId, currentUser?.id, isLoadingUser, cleanupListeners, toast]);


  const { agentDailyAchievements, agentCompetitionAchievements, podTargetSummary, agentLeaderboard, teamLeaderboard } = useMemo(() => {
    console.log(`[AgentDashboard] Memo triggered: Calculating data. isLoadingUser: ${isLoadingUser}, isLoadingData: ${isLoadingData}, currentUser: ${!!currentUser}, agentPodId: ${agentPodId}, activeCompetition: ${!!activeCompetition}`);
    if (isLoadingUser || isLoadingData || !currentUser || !agentPodId || !activeCompetition) {
        console.log("[AgentDashboard] Memo: Skipping calculation, data not ready or prerequisites missing.");
        return {
            agentDailyAchievements: { totalPoints: 0, achievements: [] },
            agentCompetitionAchievements: { totalPoints: 0, achievements: [] },
            podTargetSummary: [],
            agentLeaderboard: [],
            teamLeaderboard: []
        };
    }

    const todayStart = startOfDay(new Date());
    const todayUserLogs = Array.isArray(dailyLogs) ? dailyLogs.filter(log => log.date instanceof Timestamp && startOfDay(log.date.toDate()).getTime() === todayStart.getTime()) : [];
    const todayPodLogs = Array.isArray(podLogs) ? podLogs.filter(log => log.date instanceof Timestamp && startOfDay(log.date.toDate()).getTime() === todayStart.getTime()) : [];
    console.log(`[AgentDashboard] Memo: Found ${todayUserLogs.length} logs for current agent today.`);

    const displayRules = Array.isArray(rules) ? rules : [];

    let dailyTotalPoints = 0;
    const dailyAchievementsMap = new Map<string, AgentDailyAchievements['achievements'][0]>();
    if (currentUser && displayRules.length > 0) {
        todayUserLogs.forEach(log => {
            const rule = displayRules.find(r => r.id === log.ruleId);
            if (rule && rule.id) {
                const pointsToAdd = typeof log.points === 'number' && !isNaN(log.points) ? log.points : 0;
                dailyTotalPoints += pointsToAdd;
                const currentRuleData = dailyAchievementsMap.get(rule.id) || { ruleId: rule.id, ruleName: rule.name, ruleEmoji: rule.emoji || '❓', value: 0, points: 0 };
                const valueToAdd = typeof log.value === 'number' && !isNaN(log.value) ? log.value : 0;
                currentRuleData.value += valueToAdd;
                currentRuleData.points += pointsToAdd;
                dailyAchievementsMap.set(rule.id, currentRuleData);
            }
        });
    }
    const finalAgentDailyAchievementsList = Array.from(dailyAchievementsMap.values()).sort((a, b) => a.ruleName.localeCompare(b.ruleName));
    const finalAgentDailyAchievements: AgentDailyAchievements = { totalPoints: dailyTotalPoints, achievements: finalAgentDailyAchievementsList };
    console.log("[AgentDashboard] Memo: Calculated final agent daily achievements:", finalAgentDailyAchievements);


    let competitionTotalPoints = 0;
    const competitionAchievementsMap = new Map<string, AgentCompetitionAchievements['achievements'][0]>();
     if (currentUser && displayRules.length > 0 && Array.isArray(dailyLogs)) {
        dailyLogs.forEach(log => {
            const rule = displayRules.find(r => r.id === log.ruleId);
            if (rule && rule.id) {
                const pointsToAdd = typeof log.points === 'number' && !isNaN(log.points) ? log.points : 0;
                competitionTotalPoints += pointsToAdd;
                const currentRuleData = competitionAchievementsMap.get(rule.id) || { ruleId: rule.id, ruleName: rule.name, ruleEmoji: rule.emoji || '❓', value: 0, points: 0 };
                const valueToAdd = typeof log.value === 'number' && !isNaN(log.value) ? log.value : 0;
                currentRuleData.value += valueToAdd;
                currentRuleData.points += pointsToAdd;
                competitionAchievementsMap.set(rule.id, currentRuleData);
            }
        });
    }
    const finalAgentCompetitionAchievementsList = Array.from(competitionAchievementsMap.values()).sort((a, b) => a.ruleName.localeCompare(b.ruleName));
    const finalAgentCompetitionAchievements: AgentCompetitionAchievements = { totalPoints: competitionTotalPoints, achievements: finalAgentCompetitionAchievementsList };
    console.log("[AgentDashboard] Memo: Calculated final agent competition achievements:", finalAgentCompetitionAchievements);

    const dayOfWeek = daysOfWeek[getDay(new Date())];
    const podRuleTotalsToday: Record<string, number> = {};
    if(Array.isArray(displayRules)) {
        displayRules.forEach(rule => { if (rule && rule.id) podRuleTotalsToday[rule.id] = 0; });
    }
    console.log(`[AgentDashboard] Memo: Found ${todayPodLogs.length} logs for pod today.`);
    if(Array.isArray(todayPodLogs)){
        todayPodLogs.forEach(log => {
            if (log && log.ruleId && podRuleTotalsToday.hasOwnProperty(log.ruleId)) {
                 const valueToAdd = typeof log.value === 'number' && !isNaN(log.value) ? log.value : 0;
                podRuleTotalsToday[log.ruleId] += valueToAdd;
            }
         });
    }
    const finalPodTargetSummary: PodTargetSummary[] = Array.isArray(displayRules) ? displayRules
        .map(rule => {
            if (!rule || !rule.id) return null;
            const targetValue = dailyTargets?.[rule.id]?.[dayOfWeek];
            if (targetValue === undefined || targetValue === null || targetValue < 0) return null;
            const emojiToUse = rule.emoji && rule.emoji.trim() !== '' ? rule.emoji : '❓';
            const achieved = podRuleTotalsToday[rule.id] || 0;
            const progress = targetValue > 0 ? Math.min(100, Math.round((achieved / targetValue) * 100)) : (achieved > 0 ? 100 : 0);
            return { ruleId: rule.id, ruleName: rule.name, ruleEmoji: emojiToUse, achieved, target: targetValue, progress };
        })
        .filter((item): item is PodTargetSummary => item !== null)
        .sort((a, b) => a.ruleName.localeCompare(b.ruleName)) : [];
    console.log("[AgentDashboard] Memo: Calculated pod target summary for today:", finalPodTargetSummary);

    const agentScoresMap: Record<string, number> = {};
    if(Array.isArray(podAgents)){
        podAgents.forEach(agent => { if (agent && agent.id) agentScoresMap[agent.id] = 0; });
    }
    if(Array.isArray(podLogs)){
        podLogs.forEach(log => {
            if (log && log.agentId && agentScoresMap.hasOwnProperty(log.agentId)) {
                const pointsToAdd = typeof log.points === 'number' && !isNaN(log.points) ? log.points : 0;
                agentScoresMap[log.agentId] += pointsToAdd;
            }
        });
    }
    const agentLeaderboardDataPreSort = Array.isArray(podAgents) ? podAgents
        .map(agent => {
            if (!agent || !agent.id) return null;
            return ({
                id: agent.id, name: agent.name || 'Unknown Agent',
                totalPoints: agentScoresMap[agent.id] || 0, score: agentScoresMap[agent.id] || 0,
                avatarUrl: agent.avatarUrl, avatarInitials: agent.avatarInitials, avatarBgColor: agent.avatarBgColor,
                isCurrentUser: agent.id === currentUser?.id
            });
        }).filter((item): item is LeaderboardEntry => item !== null) : [];
    const finalAgentLeaderboard = assignDenseRanks(agentLeaderboardDataPreSort);
    console.log(`[AgentDashboard] Memo: Calculated agent leaderboard (${finalAgentLeaderboard.length} entries)`);

    const teamScoresMap: Record<string, number> = {};
    if(Array.isArray(teams)){
        teams.forEach(team => { if (team && team.id) teamScoresMap[team.id] = 0; });
    }
    if(Array.isArray(podLogs)){
        podLogs.forEach(log => {
            if (!log || !log.agentId) return;
            const agentTeam = Array.isArray(teams) ? teams.find(team => team && Array.isArray(team.agentIds) && team.agentIds.includes(log.agentId)) : undefined;
            if (agentTeam && agentTeam.id && teamScoresMap.hasOwnProperty(agentTeam.id)) {
                const pointsToAdd = typeof log.points === 'number' && !isNaN(log.points) ? log.points : 0;
                teamScoresMap[agentTeam.id] += pointsToAdd;
            }
        });
    }
    const teamLeaderboardDataPreSort = Array.isArray(teams) ? teams
        .map(team => {
             if (!team || !team.id) return null;
            return ({
                id: team.id, name: team.name || 'Unknown Team',
                totalPoints: teamScoresMap[team.id] || 0, score: teamScoresMap[team.id] || 0,
                isCurrentUserTeam: Array.isArray(team.agentIds) && team.agentIds.includes(currentUser?.id || '')
            });
        }).filter((item): item is LeaderboardEntry => item !== null) : [];
    const finalTeamLeaderboard = assignDenseRanks(teamLeaderboardDataPreSort);
    console.log(`[AgentDashboard] Memo: Calculated team leaderboard (${finalTeamLeaderboard.length} entries)`);

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
      console.error("Required info missing for save.");
      toast({ variant: "destructive", title: "Save Error", description: "Could not determine user, pod, or competition." });
      return;
    }
    const rule = rules.find(r => r.id === ruleId);
    if (!rule || !rule.id) {
         console.error(`Rule with ID ${ruleId} not found in current rules.`);
         toast({ variant: "destructive", title: "Save Error", description: "Rule definition not found." });
         return;
    }

    setIsSaving(prev => ({ ...prev, [ruleId]: true }));
    try {
      const points = rule.points * value;
      const dateTimestamp = Timestamp.fromDate(startOfDay(new Date()));
      const logEntry: Omit<DailyAchievementLog, 'id'> = {
        agentId: currentUser.id, podId: agentPodId, competitionId: activeCompetition.id,
        ruleId: rule.id, ruleName: rule.name, date: dateTimestamp, value: value, points: points,
        loggedAt: serverTimestamp() as Timestamp, loggedBy: currentUser.uid,
      };

      const achievementsRef = collection(db, 'dailyAchievements');
      const existingLogId = achievementInputs[ruleId]?.existingLogId;

      if (existingLogId) {
        const docRef = doc(achievementsRef, existingLogId);
         if (value > 0) await setDoc(docRef, logEntry, { merge: true });
         else {
            await deleteDoc(docRef);
            setAchievementInputs(prev => { const newState = { ...prev }; if (newState[ruleId]) newState[ruleId] = { ...newState[ruleId], value: 0, existingLogId: undefined }; return newState;});
         }
      } else if (value > 0) {
        const addedDoc = await addDoc(achievementsRef, logEntry);
        setAchievementInputs(prev => { const newState = { ...prev }; if (!newState[ruleId]) newState[ruleId] = { value: value, existingLogId: addedDoc.id }; else newState[ruleId].existingLogId = addedDoc.id; return newState;});
      }
    } catch (err) {
      console.error("Error saving achievement:", err);
      toast({ variant: "destructive", title: "Save Failed", description: `Could not save ${rule.name}.` });
    } finally {
      setIsSaving(prev => ({ ...prev, [ruleId]: false }));
    }
  }, [agentPodId, currentUser, activeCompetition?.id, rules, achievementInputs, toast, setAchievementInputs, setIsSaving]); // Added missing dependencies

  const debouncedSave = useMemo(() => debounce(handleSaveAchievement, 1000), [handleSaveAchievement, debounce]);

  const handleValueChange = useCallback((ruleId: string, change: number) => {
    const currentValue = achievementInputs[ruleId]?.value ?? 0;
    const newValue = Math.max(0, currentValue + change);
    setAchievementInputs(prev => ({
      ...prev,
      [ruleId]: { ...(prev[ruleId] || { value: 0, existingLogId: undefined }), value: newValue },
    }));
    debouncedSave(ruleId, newValue);
  }, [achievementInputs, debouncedSave, setAchievementInputs]);

  const isLoading = isLoadingUser || isLoadingData;
  const canLog = !isLoading && currentUser && agentPodId && Array.isArray(rules) && rules.length > 0 && activeCompetition;

  return (
    <div className="space-y-6">
        {error && !error.startsWith("No active competition") && (
            <Alert variant="destructive" className="mb-6 frosted-glass">
            <AlertCircle className="h-4 w-4" />
            <UIDescription>{error}</UIDescription>
            </Alert>
        )}

        <Card className="frosted-glass">
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <div><CardTitle className="flex items-center gap-2"><CheckSquare className="h-5 w-5"/>Today&apos;s Achievements</CardTitle></div>
                  <div className="text-right">
                      {isLoading ? <Skeleton className="h-6 w-16 rounded mt-1"/> : <p className="text-2xl font-bold text-primary">{agentDailyAchievements?.totalPoints.toLocaleString() ?? 0} pts</p>}
                  </div>
             </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {Array.from({ length: 3 }).map((_, index) => (<Skeleton key={`log-skeleton-${index}`} className="h-[130px] w-full" />))}
                    </div>
                 ) : !canLog && !error && !isLoadingUser && !agentPodId ? (
                     <p className="text-muted-foreground text-center py-6">You are not assigned to a pod. Please contact your manager.</p>
                 ) : !canLog && !error && (!Array.isArray(rules) || rules.length === 0) ? (
                    <p className="text-muted-foreground text-center py-6"> No active competition or rules found for your pod today.</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {Array.isArray(rules) && rules.map((rule) => (
                            rule.id ? (
                                <AchievementCard
                                    key={rule.id} rule={rule}
                                    currentValue={achievementInputs[rule.id]?.value ?? 0}
                                    isSaving={isSaving[rule.id] || false}
                                    onIncrement={() => handleValueChange(rule.id!, 1)}
                                    onDecrement={() => handleValueChange(rule.id!, -1)}
                                />
                            ) : null
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>

      <div className="grid gap-6 md:grid-cols-2">
            <Card className="frosted-glass shadow-md flex flex-col h-full">
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2"><ListChecks className="h-5 w-5"/><CardTitle>Your Scores</CardTitle></div>
                  <div className="text-right">
                      {isLoading ? <Skeleton className="h-6 w-16 rounded mt-1"/> : <p className="text-2xl font-bold text-primary">{agentCompetitionAchievements?.totalPoints.toLocaleString() ?? 0} pts</p>}
                  </div>
              </CardHeader>
              <CardContent className="flex-grow">
                  {isLoading ? <div className="space-y-2"><Skeleton className="h-4 w-full rounded mb-1" /><Skeleton className="h-4 w-5/6 rounded mb-1" /><Skeleton className="h-4 w-3/4 rounded" /></div>
                   : agentCompetitionAchievements && agentCompetitionAchievements.achievements.length > 0 ? (
                      <div className="space-y-1 text-sm">
                          {agentCompetitionAchievements.achievements.map(ach => (
                              <div key={ach.ruleId} className="flex items-center justify-between whitespace-nowrap">
                                  <span className="font-medium truncate" title={ach.ruleName}>{ach.ruleEmoji} {ach.ruleName}</span>
                                  <span className="text-muted-foreground">{ach.value.toLocaleString()} ({ach.points.toLocaleString()} pts)</span>
                              </div>
                          ))}
                      </div>
                  ) : !error && !isLoading && activeCompetition ? <p className="text-sm text-muted-foreground text-center pt-4">No achievements logged yet for this competition.</p> : null }
              </CardContent>
            </Card>

            <Card className="frosted-glass shadow-md flex flex-col h-full">
              <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5"/> Pod Targets Today</CardTitle><CardDescription>Your pod&apos;s progress towards today&apos;s targets.</CardDescription></CardHeader>
               <CardContent className="flex-grow">
                    {isLoading ? <div className="space-y-3"><Skeleton className="h-6 w-full rounded mb-2" /><Skeleton className="h-6 w-5/6 rounded mb-2" /><Skeleton className="h-6 w-3/4 rounded" /></div>
                    : Array.isArray(podTargetSummary) && podTargetSummary.length > 0 ? (
                       <div className="space-y-3">
                           {podTargetSummary.map(summary => (
                               <div key={summary.ruleId}>
                                   <div className="flex items-center justify-between text-sm mb-1">
                                       <span className="font-medium truncate" title={summary.ruleName}>{summary.ruleEmoji} {summary.ruleName}</span>
                                       <span className={cn("font-semibold", summary.progress !== undefined && summary.progress >= 100 ? "text-green-600" : "text-muted-foreground")}>{summary.achieved.toLocaleString()} / {summary.target?.toLocaleString()}</span>
                                   </div>
                                   <Progress value={summary.progress ?? 0} className="h-2" />
                               </div>
                           ))}
                       </div>
                   ) : !error && !isLoading && activeCompetition ? <p className="text-muted-foreground text-sm text-center pt-4">No targets set for your pod today.</p> : null }
               </CardContent>
            </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
          {isLoading ? (<><Skeleton className="h-[400px] w-full frosted-glass" /><Skeleton className="h-[400px] w-full frosted-glass" /></>)
           : (<>
                  {Array.isArray(teamLeaderboard) && teamLeaderboard.length > 0 ? <Leaderboard title="Team Leaderboard" entries={teamLeaderboard} description="Current Competition Ranking" />
                  : !error && !isLoading && activeCompetition && Array.isArray(teams) && teams.length > 0 ? <Card className="h-[400px] flex items-center justify-center shadow-md frosted-glass"><CardContent className="text-muted-foreground text-center">No team data available yet.</CardContent></Card>
                  : !error && !isLoading && activeCompetition && (!Array.isArray(teams) || teams.length === 0) ? <Card className="h-[400px] flex items-center justify-center shadow-md frosted-glass"><CardContent className="text-muted-foreground text-center">No teams defined.</CardContent></Card>
                  : null}
                   {Array.isArray(agentLeaderboard) && agentLeaderboard.length > 0 ? <Leaderboard title="Agent Leaderboard" entries={agentLeaderboard} description="Current Competition Ranking" />
                   : !error && !isLoading && activeCompetition && Array.isArray(podAgents) && podAgents.length > 0 ? <Card className="h-[400px] flex items-center justify-center shadow-md frosted-glass"><CardContent className="text-muted-foreground text-center">No agent data available yet.</CardContent></Card>
                   : !error && !isLoading && activeCompetition && (!Array.isArray(podAgents) || podAgents.length === 0) ? <Card className="h-[400px] flex items-center justify-center shadow-md frosted-glass"><CardContent className="text-muted-foreground text-center">No agents in pod.</CardContent></Card>
                  : null}
                  {error === "No active competition found for your pod today." && !isLoading && <Card className="md:col-span-2 h-[100px] flex items-center justify-center shadow-md frosted-glass"><CardContent className="text-muted-foreground text-center">No competition currently active.</CardContent></Card>}
               </>)
           }
      </div>
    </div>
  );
}
