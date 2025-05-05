
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Leaderboard } from '@/components/leaderboard';
import { Target, Medal, Trophy, ClipboardList, AlertCircle, CalendarIcon, Loader2, Activity, ListChecks } from 'lucide-react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription as UIDescription } from "@/components/ui/alert"; // Renamed to avoid conflict
import { collection, query, where, getDocs, Timestamp, doc, getDoc, orderBy, onSnapshot, Unsubscribe, setDoc, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { DailyAchievementLog } from '@/app/(admin)/admin/log-achievements/page';
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog';
import type { DailyTargetData } from '@/app/(admin)/admin/pod-targets/page';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AchievementCard } from '@/components/achievement-card';

// Interfaces (LeaderboardEntry, DailyAchievementLog, etc.)
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
  score: number; // Keep score for Leaderboard component compatibility
}

interface CompetitionWithRules extends Competition {
    teams?: any[];
    id: string; // Ensure CompetitionWithRules has an id
}

// Represents achievement totals for the agent for the *entire competition*
interface AgentCompetitionAchievements {
  totalPoints: number;
  achievements: { ruleId: string; ruleName: string; ruleEmoji: string; value: number }[];
}

// Represents achievements for the agent for *today*
interface AgentDailyAchievements {
    totalPoints: number;
    achievements: { ruleId: string; ruleName: string; ruleEmoji: string; value: number }[];
}

interface PodTargetSummary {
  ruleId: string;
  ruleName: string;
  ruleEmoji: string;
  achieved: number;
  target: number | null;
}

// State Interface for Achievement Inputs (for today)
interface AgentAchievementInputState {
  [ruleId: string]: {
    value: number;
    existingLogId?: string;
  };
}

const daysOfWeek = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Helper functions for rank styling (remains the same)
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
        default: return {}; // No special style for other ranks
    }
};

export default function AgentDashboardPage() {
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // State for fetched data
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [agentPodId, setAgentPodId] = useState<string | null>(null);
  const [rules, setRules] = useState<RuleFormData[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyAchievementLog[]>([]); // Logs for the current user for the competition period
  const [podLogs, setPodLogs] = useState<DailyAchievementLog[]>([]); // Logs for the pod (for target summary & leaderboards) for competition period
  const [podAgents, setPodAgents] = useState<AppUser[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [dailyTargets, setDailyTargets] = useState<DailyTargetData | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeCompetition, setActiveCompetition] = useState<CompetitionWithRules | null>(null); // Store active competition

  // State for Achievement Logging (today's values)
  const [achievementInputs, setAchievementInputs] = useState<AgentAchievementInputState>({});
  const [isSaving, setIsSaving] = useState<{ [key: string]: boolean }>({});

   // --- Listener Management Ref ---
   // Use refs to keep track of unsubscribe functions to avoid stale closures
   const listenerRefs = React.useRef<{
       auth?: Unsubscribe;
       userDoc?: Unsubscribe;
       agents?: Unsubscribe;
       competition?: Unsubscribe;
       userLogs?: Unsubscribe;
       podLogs?: Unsubscribe;
       targets?: Unsubscribe;
       dailyAchievements?: Unsubscribe;
   }>({});

   // Centralized cleanup function
   const cleanupListeners = useCallback(() => {
       console.log("[AgentDashboard] Running cleanupListeners...");
       Object.values(listenerRefs.current).forEach(unsubscribe => {
           if (unsubscribe) {
                try {
                   unsubscribe();
                } catch (e) {
                    console.error("Error unsubscribing:", e);
                }
           }
       });
       listenerRefs.current = {}; // Reset refs after cleanup
   }, []);


   // 1. Auth Listener
   useEffect(() => {
       setIsLoadingUser(true);
       console.log("[AgentDashboard] Setting up auth listener...");

       listenerRefs.current.auth = auth.onAuthStateChanged(async (user) => {
           // Always clean up previous user doc listener when auth state changes
           if (listenerRefs.current.userDoc) {
               console.log("[AgentDashboard] Cleaning up previous user doc listener on auth change.");
               listenerRefs.current.userDoc();
               listenerRefs.current.userDoc = undefined;
           }

           if (user) {
               console.log(`[AgentDashboard] Auth state changed: User found (UID: ${user.uid})`);
               const userDocRef = doc(db, 'users', user.uid);
               listenerRefs.current.userDoc = onSnapshot(userDocRef, (docSnap) => {
                   if (docSnap.exists()) {
                       const userData = { id: docSnap.id, ...docSnap.data() } as AppUser;
                       console.log("[AgentDashboard] User document snapshot received:", userData);
                       // Use functional updates to avoid stale state issues
                       setCurrentUser(prev => JSON.stringify(prev) !== JSON.stringify(userData) ? userData : prev);
                       const newPodId = userData.podId || null;
                       setAgentPodId(prevPodId => {
                           if (prevPodId !== newPodId) {
                               console.log(`[AgentDashboard] Agent Pod ID changed from ${prevPodId} to: ${newPodId}`);
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
                       console.error(`[AgentDashboard] User document not found in Firestore for UID: ${user.uid}`);
                       setError("Could not find your user profile data.");
                       setCurrentUser(null);
                       setAgentPodId(null);
                   }
                   setIsLoadingUser(false);
               }, (err) => {
                   console.error("[AgentDashboard] Error listening to user document:", err);
                   setError("Failed to load your profile information.");
                   setCurrentUser(null);
                   setAgentPodId(null);
                   setIsLoadingUser(false);
               });
           } else {
               console.log("[AgentDashboard] Auth state changed: No user logged in.");
               setError("You must be logged in.");
               setCurrentUser(null);
               setAgentPodId(null);
               setIsLoadingUser(false);
           }
       });

       // Cleanup function for the *auth* listener itself
       return () => {
           console.log("[AgentDashboard] Cleaning up auth listener and any active userDoc listener.");
           if (listenerRefs.current.auth) listenerRefs.current.auth();
           if (listenerRefs.current.userDoc) listenerRefs.current.userDoc(); // Also cleanup user doc listener here
           listenerRefs.current.auth = undefined;
           listenerRefs.current.userDoc = undefined;
       };
       // No dependencies needed for the auth listener setup itself
   }, []); // Run only once on mount


    // 2. Fetch Competition Data, Pod Agents, and setup Log/Target Listeners
    useEffect(() => {
        let isMounted = true;
        console.log(`[AgentDashboard] Data Effect triggered: isLoadingUser=${isLoadingUser}, agentPodId=${agentPodId}, currentUser=${!!currentUser?.id}`);

        // Cleanup function for this specific effect instance
        const cleanupDataListeners = () => {
            console.log("[AgentDashboard] Cleaning up Data Listeners (Agents, Competition, Logs, Targets, Daily Ach.)");
            if (listenerRefs.current.agents) listenerRefs.current.agents();
            if (listenerRefs.current.competition) listenerRefs.current.competition();
            if (listenerRefs.current.userLogs) listenerRefs.current.userLogs();
            if (listenerRefs.current.podLogs) listenerRefs.current.podLogs();
            if (listenerRefs.current.targets) listenerRefs.current.targets();
            if (listenerRefs.current.dailyAchievements) listenerRefs.current.dailyAchievements();
            // Reset refs for this effect
            listenerRefs.current.agents = undefined;
            listenerRefs.current.competition = undefined;
            listenerRefs.current.userLogs = undefined;
            listenerRefs.current.podLogs = undefined;
            listenerRefs.current.targets = undefined;
            listenerRefs.current.dailyAchievements = undefined;
        };

        if (!agentPodId || !currentUser?.id || isLoadingUser) {
            console.log("[AgentDashboard] Data Effect: Skipping/Cleaning up, prerequisites not met.");
            cleanupDataListeners(); // Clean up any potentially running listeners
            if (!isLoadingUser) { // Only set loading false if user check is complete
                setIsLoadingData(false);
                setActiveCompetition(null);
                setRules([]);
                setTeams([]);
                setPodAgents([]);
                setDailyLogs([]);
                setPodLogs([]);
                setDailyTargets(null);
                setAchievementInputs({});
            }
            return; // Exit effect early
        }

        console.log("[AgentDashboard] Data Effect: Starting data fetch and listeners for pod:", agentPodId);
        setIsLoadingData(true); // Set loading true only when we are actually fetching

        // --- Setup Pod Agents Listener ---
        console.log("[AgentDashboard] Data Effect: Setting up agents listener for pod:", agentPodId);
        const usersRef = collection(db, 'users');
        const agentsQuery = query(usersRef, where('podId', '==', agentPodId), where('roles', 'array-contains', 'agent'), orderBy('name'));
        listenerRefs.current.agents = onSnapshot(agentsQuery, (agentsSnapshot) => {
            if (!isMounted) return;
            const fetchedAgents = agentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
            // Functional update to avoid infinite loop
            setPodAgents(currentAgents => {
                const currentAgentIds = currentAgents.map(a => a.id).sort().join(',');
                const fetchedAgentIds = fetchedAgents.map(a => a.id).sort().join(',');
                if (currentAgentIds !== fetchedAgentIds) {
                    console.log("[AgentDashboard] Pod agents listener updated, found:", fetchedAgents.length);
                    return fetchedAgents;
                }
                return currentAgents;
            });
        }, (err) => {
            if (isMounted) {
                console.error("[AgentDashboard] Error listening to pod agents:", err);
                setError("Failed to load pod member data.");
                // Optionally set loading false here if this is critical path
            }
        });

        // --- Setup Competition Listener ---
        console.log("[AgentDashboard] Data Effect: Setting up competition listener for pod:", agentPodId);
        const competitionsRef = collection(db, 'competitions');
        const todayTimestamp = Timestamp.fromDate(startOfDay(new Date()));
        const competitionQuery = query(
            competitionsRef,
            where('podIds', 'array-contains', agentPodId),
            where('startDate', '<=', todayTimestamp),
            orderBy('startDate', 'desc')
        );
        listenerRefs.current.competition = onSnapshot(competitionQuery, (competitionSnapshot) => {
            if (!isMounted) return;
            console.log(`[AgentDashboard] Data Effect: Competition listener triggered. Found ${competitionSnapshot.docs.length} potential competitions.`);
            let foundActiveCompetition: CompetitionWithRules | null = null;
            for (const docSnap of competitionSnapshot.docs) {
                const comp = { id: docSnap.id, ...docSnap.data() } as CompetitionWithRules;
                if (comp.endDate && comp.endDate instanceof Timestamp && comp.endDate.toDate() >= todayTimestamp) {
                    foundActiveCompetition = comp;
                    console.log("[AgentDashboard] Data Effect: Found active competition:", comp.id, comp.name);
                    break;
                }
            }

            // Update active competition state and setup/cleanup dependent listeners
            setActiveCompetition(currentActiveComp => {
                if (foundActiveCompetition?.id !== currentActiveComp?.id) {
                    console.log(`[AgentDashboard] Active competition changed to: ${foundActiveCompetition?.id ?? 'None'}. Cleaning up old listeners.`);
                    // Clean up ONLY dependent listeners before setting up new ones
                    if (listenerRefs.current.userLogs) listenerRefs.current.userLogs();
                    if (listenerRefs.current.podLogs) listenerRefs.current.podLogs();
                    if (listenerRefs.current.targets) listenerRefs.current.targets();
                    if (listenerRefs.current.dailyAchievements) listenerRefs.current.dailyAchievements();
                    listenerRefs.current.userLogs = undefined;
                    listenerRefs.current.podLogs = undefined;
                    listenerRefs.current.targets = undefined;
                    listenerRefs.current.dailyAchievements = undefined;

                    if (foundActiveCompetition) {
                        const activeCompId = foundActiveCompetition.id;
                        const activeCompRules = (foundActiveCompetition.rules || []).filter(rule => rule.name.toLowerCase() !== 'bonus');
                        setRules(activeCompRules);
                        setTeams(foundActiveCompetition.teams || []);
                        console.log(`[AgentDashboard] Data Effect: Set ${activeCompRules.length} rules and ${foundActiveCompetition.teams?.length ?? 0} teams for competition ${activeCompId}`);

                        const achievementsRef = collection(db, 'dailyAchievements');
                        const compStartDate = foundActiveCompetition.startDate;

                        // User Competition Logs Listener
                        console.log("[AgentDashboard] Data Effect: Setting up new user logs listener for user:", currentUser.id, " competition:", activeCompId);
                        const userLogsQuery = query(
                            achievementsRef,
                            where('agentId', '==', currentUser.id),
                            where('podId', '==', agentPodId),
                            where('competitionId', '==', activeCompId),
                            where('date', '>=', compStartDate)
                        );
                        listenerRefs.current.userLogs = onSnapshot(userLogsQuery, (snapshot) => {
                             if (!isMounted) return;
                            const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
                             console.log(`[AgentDashboard] User logs listener updated, found ${logs.length} logs for user in competition ${activeCompId}.`);
                            setDailyLogs(logs);
                         }, (err) => { if (isMounted) console.error("[AgentDashboard] Error listening to user logs:", err); });

                        // Pod Logs Listener
                        console.log("[AgentDashboard] Data Effect: Setting up new pod logs listener for competition:", activeCompId);
                        const podLogsQuery = query(
                            achievementsRef,
                            where('podId', '==', agentPodId),
                            where('competitionId', '==', activeCompId),
                            where('date', '>=', compStartDate)
                        );
                        listenerRefs.current.podLogs = onSnapshot(podLogsQuery, (snapshot) => {
                            if (!isMounted) return;
                            const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
                            console.log(`[AgentDashboard] Pod logs listener updated, found ${logs.length} logs for pod in competition ${activeCompId}.`);
                            setPodLogs(logs);
                        }, (err) => { if (isMounted) console.error("[AgentDashboard] Error listening to pod logs:", err); });

                        // Targets Listener
                        const targetsDocId = `${activeCompId}_${agentPodId}`;
                        console.log("[AgentDashboard] Data Effect: Setting up new targets listener for doc:", targetsDocId);
                        const targetsDocRef = doc(db, 'dailyPodTargets', targetsDocId);
                        listenerRefs.current.targets = onSnapshot(targetsDocRef, (docSnap) => {
                             if (!isMounted) return;
                             const targetData = docSnap.exists() ? docSnap.data() as DailyTargetData : null;
                             console.log(`[AgentDashboard] Targets listener updated, target doc exists: ${docSnap.exists()}, Data:`, targetData);
                             setDailyTargets(targetData);
                        }, (err) => { if (isMounted) console.error("[AgentDashboard] Error listening to daily targets:", err); });

                        // Daily Achievements Listener (for today)
                        const currentDate = startOfDay(new Date());
                        console.log(`[AgentDashboard] Data Effect: Setting up daily achievements listener for competition ${activeCompId}, date ${currentDate.toISOString().split('T')[0]}`);
                        const dailyAchievementsRef = collection(db, 'dailyAchievements');
                        const dateTimestamp = Timestamp.fromDate(currentDate);
                        const dailyQuery = query(
                            dailyAchievementsRef,
                            where('agentId', '==', currentUser.id),
                            where('podId', '==', agentPodId),
                            where('date', '==', dateTimestamp),
                            where('competitionId', '==', activeCompId)
                        );
                         listenerRefs.current.dailyAchievements = onSnapshot(dailyQuery, (snapshot) => {
                             if (!isMounted) return;
                             console.log(`[AgentDashboard] Daily achievements listener updated, found ${snapshot.docs.length} logs for today.`);
                             const existingAchievements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
                             const initialInputs: AgentAchievementInputState = {};
                             activeCompRules.forEach(rule => {
                                 if (!rule.id) return;
                                 const existingLog = existingAchievements.find(log => log.ruleId === rule.id);
                                 initialInputs[rule.id] = {
                                     value: existingLog ? existingLog.value : 0,
                                     existingLogId: existingLog?.id,
                                 };
                             });
                             setAchievementInputs(initialInputs);
                         }, (err) => {
                             if (isMounted) {
                                 console.error("[AgentDashboard] Error listening to daily achievements:", err);
                                 setError("Failed to load today's achievements.");
                                 setAchievementInputs({});
                             }
                         });

                    } else {
                        console.log("[AgentDashboard] Data Effect: No active competition found, clearing related state.");
                        setRules([]);
                        setTeams([]);
                        setDailyLogs([]);
                        setPodLogs([]);
                        setDailyTargets(null);
                        setAchievementInputs({});
                        setError(prevError => prevError?.startsWith("You are not") || prevError?.startsWith("Could not find") || prevError?.startsWith("You must") ? prevError : "No active competition found for your pod today.");
                    }
                    setIsLoadingData(false); // Set loading false *after* setting up listeners or clearing state
                    return foundActiveCompetition;
                }
                // If competition didn't change, no need to update listeners or loading state
                 return currentActiveComp;
            });
        }, (err) => {
             if (isMounted) {
                 console.error("[AgentDashboard] Error listening to competitions:", err);
                 setError("Failed to load competition data.");
                 setIsLoadingData(false);
             }
        });

        // Cleanup function for this effect instance
        return () => {
             isMounted = false;
             cleanupDataListeners();
        };
        // Dependencies: Rerun when user or pod changes
    }, [agentPodId, currentUser?.id, isLoadingUser]); // Added isLoadingUser


  // 4. Process data (Scores, Leaderboards) - useMemo
  const { agentDailyAchievements, agentCompetitionAchievements, podTargetSummary, agentLeaderboard, teamLeaderboard } = useMemo(() => {
    console.log(`[AgentDashboard] Memo triggered: Calculating data. Daily Logs: ${dailyLogs.length}, Pod Logs: ${podLogs.length}, Agents: ${podAgents.length}, Teams: ${teams.length}, Rules: ${rules.length}`);

     // Filter logs for Today (used for Daily Score and Pod Target Summary)
     const todayStart = startOfDay(new Date());
     const todayUserLogs = dailyLogs.filter(log => log.date instanceof Timestamp && startOfDay(log.date.toDate()).getTime() === todayStart.getTime());
     const todayPodLogs = podLogs.filter(log => log.date instanceof Timestamp && startOfDay(log.date.toDate()).getTime() === todayStart.getTime());
     console.log(`[AgentDashboard] Memo: Found ${todayUserLogs.length} logs for current agent today.`);

    // --- Calculate Agent's *Daily* Achievements ---
     let dailyTotalPoints = 0;
     const dailyAchievementsMap = new Map<string, { ruleId: string; ruleName: string; ruleEmoji: string; value: number }>();
     const displayRules = rules.filter(rule => rule.name.toLowerCase() !== 'bonus');

     if (currentUser && displayRules.length > 0) {
         todayUserLogs.forEach(log => {
             const rule = displayRules.find(r => r.id === log.ruleId);
             if (rule) {
                 const pointsToAdd = typeof log.points === 'number' && !isNaN(log.points) ? log.points : 0;
                 dailyTotalPoints += pointsToAdd;
                 const ruleKey = rule.id!;
                 const currentRuleTotal = dailyAchievementsMap.get(ruleKey) || { ruleId: ruleKey, ruleName: rule.name, ruleEmoji: rule.emoji || '❓', value: 0 };
                 const valueToAdd = typeof log.value === 'number' && !isNaN(log.value) ? log.value : 0;
                 currentRuleTotal.value += valueToAdd;
                 dailyAchievementsMap.set(ruleKey, currentRuleTotal);
             }
         });
     }
     const finalAgentDailyAchievementsList = Array.from(dailyAchievementsMap.values()).sort((a, b) => a.ruleName.localeCompare(b.ruleName));
     const finalAgentDailyAchievements: AgentDailyAchievements = { totalPoints: dailyTotalPoints, achievements: finalAgentDailyAchievementsList };
     console.log("[AgentDashboard] Memo: Calculated final agent daily achievements:", finalAgentDailyAchievements);


    // --- Calculate Agent's *Competition* Achievements ---
    let competitionTotalPoints = 0;
    const competitionAchievementsMap = new Map<string, { ruleId: string; ruleName: string; ruleEmoji: string; value: number }>();

    if (currentUser && displayRules.length > 0) {
        dailyLogs.forEach(log => { // Use ALL dailyLogs for the competition period
            const rule = displayRules.find(r => r.id === log.ruleId);
            if (rule) {
                const pointsToAdd = typeof log.points === 'number' && !isNaN(log.points) ? log.points : 0;
                competitionTotalPoints += pointsToAdd;
                const ruleKey = rule.id!;
                const currentRuleTotal = competitionAchievementsMap.get(ruleKey) || { ruleId: ruleKey, ruleName: rule.name, ruleEmoji: rule.emoji || '❓', value: 0 };
                const valueToAdd = typeof log.value === 'number' && !isNaN(log.value) ? log.value : 0;
                currentRuleTotal.value += valueToAdd;
                competitionAchievementsMap.set(ruleKey, currentRuleTotal);
            }
        });
    }
    const finalAgentCompetitionAchievementsList = Array.from(competitionAchievementsMap.values()).sort((a, b) => a.ruleName.localeCompare(b.ruleName));
    const finalAgentCompetitionAchievements: AgentCompetitionAchievements = { totalPoints: competitionTotalPoints, achievements: finalAgentCompetitionAchievementsList };
    console.log("[AgentDashboard] Memo: Calculated final agent competition achievements:", finalAgentCompetitionAchievements);


    // --- Calculate Pod Target Summary for Today ---
    const dayOfWeek = daysOfWeek[getDay(new Date())];
    const podRuleTotalsToday: Record<string, number> = {};
    displayRules.forEach(rule => { if (rule.id) podRuleTotalsToday[rule.id] = 0; });
    console.log(`[AgentDashboard] Memo: Found ${todayPodLogs.length} logs for pod today.`);

    todayPodLogs.forEach(log => {
        if (podRuleTotalsToday.hasOwnProperty(log.ruleId)) {
             const valueToAdd = typeof log.value === 'number' && !isNaN(log.value) ? log.value : 0;
            podRuleTotalsToday[log.ruleId] += valueToAdd;
        }
     });

    const finalPodTargetSummary: PodTargetSummary[] = displayRules
        .map(rule => {
            if (!rule.id) return null;
            const targetValue = dailyTargets?.[rule.id]?.[dayOfWeek];
            console.log(`[AgentDashboard] Memo: Target for Rule ${rule.name} (${rule.id}) on ${dayOfWeek}: ${targetValue}`);
            if (targetValue === undefined || targetValue === null) return null;
            const emojiToUse = rule.emoji && rule.emoji.trim() !== '' ? rule.emoji : '❓';
            return { ruleId: rule.id, ruleName: rule.name, ruleEmoji: emojiToUse, achieved: podRuleTotalsToday[rule.id] || 0, target: targetValue };
        })
        .filter((item): item is PodTargetSummary => item !== null)
        .sort((a, b) => a.ruleName.localeCompare(b.ruleName));
     console.log("[AgentDashboard] Memo: Calculated pod target summary for today:", finalPodTargetSummary);

     // --- Calculate Leaderboards (using all fetched podLogs for the competition duration) ---
     const agentScoresMap: Record<string, number> = {};
     podAgents.forEach(agent => { if(agent.id) agentScoresMap[agent.id] = 0; });
     podLogs.forEach(log => {
        if (agentScoresMap.hasOwnProperty(log.agentId)) {
            const pointsToAdd = typeof log.points === 'number' && !isNaN(log.points) ? log.points : 0;
            agentScoresMap[log.agentId] += pointsToAdd;
        }
     });
     const finalAgentLeaderboard: LeaderboardEntry[] = podAgents
       .map(agent => ({
         id: agent.id!,
         name: agent.name,
         totalPoints: agentScoresMap[agent.id!] || 0,
         score: agentScoresMap[agent.id!] || 0,
         avatarUrl: agent.avatarUrl,
         avatarInitials: agent.avatarInitials,
         avatarBgColor: agent.avatarBgColor,
         isCurrentUser: agent.id === currentUser?.id
       }))
       .sort((a, b) => b.totalPoints - a.totalPoints)
       .map((entry, index) => ({ ...entry, rank: index + 1 }));
     console.log(`[AgentDashboard] Memo: Calculated agent leaderboard (${finalAgentLeaderboard.length} entries)`);


     const teamScoresMap: Record<string, number> = {};
     teams.forEach(team => { teamScoresMap[team.id] = 0; });
     podLogs.forEach(log => {
        const agentTeam = teams.find(team => team.agentIds?.includes(log.agentId));
        if (agentTeam && teamScoresMap.hasOwnProperty(agentTeam.id)) {
            const pointsToAdd = typeof log.points === 'number' && !isNaN(log.points) ? log.points : 0;
            teamScoresMap[agentTeam.id] += pointsToAdd;
        }
     });
     const finalTeamLeaderboard: LeaderboardEntry[] = teams
       .map(team => ({
         id: team.id,
         name: team.name,
         totalPoints: teamScoresMap[team.id] || 0,
         score: teamScoresMap[team.id] || 0,
         isCurrentUserTeam: team.agentIds?.includes(currentUser?.id || '')
       }))
       .sort((a, b) => b.totalPoints - a.totalPoints)
       .map((entry, index) => ({ ...entry, rank: index + 1 }));
     console.log(`[AgentDashboard] Memo: Calculated team leaderboard (${finalTeamLeaderboard.length} entries)`);

    return {
        agentDailyAchievements: finalAgentDailyAchievements, // Today's achievements
        agentCompetitionAchievements: finalAgentCompetitionAchievements, // Competition achievements
        podTargetSummary: finalPodTargetSummary,
        agentLeaderboard: finalAgentLeaderboard,
        teamLeaderboard: finalTeamLeaderboard
    };
  }, [dailyLogs, podLogs, rules, dailyTargets, currentUser, podAgents, teams]); // Dependency array


  // --- Achievement Card Logic (Moved from achievements page) ---
  const handleValueChange = useCallback((ruleId: string, change: number) => {
    const currentValue = achievementInputs[ruleId]?.value ?? 0;
    const newValue = Math.max(0, currentValue + change);
    setAchievementInputs(prev => ({
      ...prev,
      [ruleId]: { ...prev[ruleId], value: newValue },
    }));
    debouncedSave(ruleId, newValue);
  }, [achievementInputs]); // Depend on achievementInputs to get the latest existingLogId

  const debounce = (func: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout | null = null;
    return (...args: any[]) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  };

  const handleSaveAchievement = async (ruleId: string, value: number) => {
    if (!agentPodId || !currentUser?.id || !activeCompetition?.id) {
      console.error("Required info missing for save.");
      toast({ variant: "destructive", title: "Save Error", description: "Could not determine user, pod, or competition." });
      return;
    }
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) {
         console.error(`Rule with ID ${ruleId} not found in current rules.`);
         toast({ variant: "destructive", title: "Save Error", description: "Rule definition not found." });
         return;
    }

    setIsSaving(prev => ({ ...prev, [ruleId]: true }));
    try {
      const points = rule.points * value;
      const dateTimestamp = Timestamp.fromDate(startOfDay(new Date())); // Log for current day
      const logEntry: Omit<DailyAchievementLog, 'id'> = {
        agentId: currentUser.id,
        podId: agentPodId,
        competitionId: activeCompetition.id,
        ruleId: rule.id!,
        ruleName: rule.name,
        date: dateTimestamp,
        value: value,
        points: points,
        loggedAt: serverTimestamp(),
        loggedBy: currentUser.uid,
      };

      const achievementsRef = collection(db, 'dailyAchievements');
      const existingLogId = achievementInputs[ruleId]?.existingLogId;

      if (existingLogId) {
        const docRef = doc(achievementsRef, existingLogId);
         if (value > 0) {
             await setDoc(docRef, logEntry, { merge: true });
             console.log(`Updated log ${existingLogId} for rule ${rule.name} to value ${value}`);
         } else {
             await deleteDoc(docRef);
             console.log(`Deleted log ${existingLogId} for rule ${rule.name} as value is 0`);
             // Update state immediately to reflect deletion and remove existingLogId
             setAchievementInputs(prev => {
                 const newState = { ...prev };
                 if (newState[ruleId]) {
                    newState[ruleId] = { ...newState[ruleId], existingLogId: undefined };
                 }
                 return newState;
             });
         }
      } else if (value > 0) {
        const addedDoc = await addDoc(achievementsRef, logEntry);
        console.log(`Created new log ${addedDoc.id} for rule ${rule.name} with value ${value}`);
        // Update state with the new ID immediately
        setAchievementInputs(prev => {
          const newState = { ...prev };
           // Ensure the rule entry exists before trying to update it
           if (!newState[ruleId]) {
               newState[ruleId] = { value: value, existingLogId: addedDoc.id };
           } else {
               newState[ruleId].existingLogId = addedDoc.id;
           }
          return newState;
        });
      }
    } catch (err) {
      console.error("Error saving achievement:", err);
      toast({ variant: "destructive", title: "Save Failed", description: `Could not save ${rule.name}.` });
    } finally {
      setIsSaving(prev => ({ ...prev, [ruleId]: false }));
    }
  };

   const debouncedSave = useMemo(() => debounce(handleSaveAchievement, 1000),
     // Ensure all necessary and stable dependencies are included
     [agentPodId, currentUser?.id, activeCompetition?.id, rules, toast, achievementInputs] // Removed handleSaveAchievement itself
   );


  const isLoading = isLoadingUser || isLoadingData;
  const canLog = !isLoading && currentUser && agentPodId && rules.length > 0;

  return (
    <div className="space-y-6">
      {error && error !== "No active competition found for your pod today." && (
         <Alert variant="destructive" className="mb-6">
           <AlertCircle className="h-4 w-4" />
           <UIDescription>{error}</UIDescription>
         </Alert>
      )}

        {/* Log Achievements Section */}
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                    <CardTitle>Today's Achievements</CardTitle>
                    {/* Removed CardDescription about logging */}
                </div>
                 {/* Display Daily Score */}
                 <div className="text-right">
                     <p className="text-xs text-muted-foreground">Today's Score</p>
                     {isLoading ? (
                         <Skeleton className="h-6 w-16 rounded mt-1"/>
                     ) : (
                         <p className="text-2xl font-bold text-primary">{agentDailyAchievements?.totalPoints.toLocaleString() ?? 0} pts</p>
                     )}
                 </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <Skeleton key={`log-skeleton-${index}`} className="h-[130px] w-full" />
                        ))}
                    </div>
                 ) : !canLog && !error && !isLoadingUser && !agentPodId ? (
                     <p className="text-muted-foreground text-center py-6">You are not assigned to a pod. Please contact your manager.</p>
                 ) : !canLog && !error && rules.length === 0 ? (
                    <p className="text-muted-foreground text-center py-6">
                        No competition rules found for your pod today.
                    </p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {rules.map((rule) => (
                            rule.id ? (
                                <AchievementCard
                                    key={rule.id}
                                    rule={rule}
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


      {/* Scores and Targets Section */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
          {/* Your Scores Card */}
           <Card className="shadow-md lg:col-span-2">
             <CardHeader>
               <CardTitle className="flex items-center gap-2"> <ListChecks className="h-5 w-5"/> Your Scores</CardTitle>
                <CardDescription>Achievements logged for the entire competition period.</CardDescription>
             </CardHeader>
             <CardContent className="grid grid-cols-1 gap-6">
                   <div>
                      {isLoading ? (
                           <div className="space-y-2">
                                <Skeleton className="h-6 w-1/4 rounded mb-1" />
                                <Skeleton className="h-4 w-full rounded" />
                                <Skeleton className="h-4 w-5/6 rounded" />
                           </div>
                       ) : agentCompetitionAchievements ? (
                           <>
                                {/* Competition Total Score */}
                                <div className="text-2xl font-bold text-primary mb-2">{agentCompetitionAchievements.totalPoints.toLocaleString()} pts</div>
                                <p className="text-xs text-muted-foreground mb-4">Competition Total</p>
                                {/* Competition Achievements Breakdown */}
                                {agentCompetitionAchievements.achievements.length > 0 ? (
                                    <div className="space-y-1 text-sm">
                                        {/* Display achievements in a list */}
                                        {agentCompetitionAchievements.achievements.map(ach => (
                                            <div key={ach.ruleId} className="flex items-center justify-between whitespace-nowrap">
                                                <span className="font-medium truncate" title={ach.ruleName}>
                                                    {ach.ruleEmoji} {ach.ruleName}
                                                </span>
                                                <span className="text-muted-foreground">{ach.value.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No achievements logged yet for this competition.</p>
                                )}
                           </>
                       ) : !error ? (
                           <p className="text-muted-foreground">Could not load your competition scores.</p>
                       ) : null}
                   </div>
             </CardContent>
           </Card>

           {/* Pod Target Summary Card */}
           <Card className="shadow-md">
              <CardHeader>
                   <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5"/> Pod Targets Today</CardTitle>
                   <CardDescription>Your pod's progress towards today's targets.</CardDescription>
              </CardHeader>
              <CardContent>
                   {isLoading ? (
                        <div className="space-y-2">
                           <Skeleton className="h-4 w-full rounded" />
                           <Skeleton className="h-4 w-5/6 rounded" />
                           <Skeleton className="h-4 w-3/4 rounded" />
                        </div>
                    ) : podTargetSummary.length > 0 ? (
                       <div className="space-y-1 text-sm">
                           {podTargetSummary.map(summary => (
                               <div key={summary.ruleId} className="flex items-center justify-between whitespace-nowrap">
                                   <span className="font-medium truncate" title={summary.ruleName}>
                                       {summary.ruleEmoji} {summary.ruleName}
                                   </span>
                                   <span className={cn("font-semibold", summary.target !== null && summary.achieved >= summary.target ? "text-green-600" : "text-muted-foreground")}>
                                       {summary.achieved.toLocaleString()}
                                       {summary.target !== null ? ` / ${summary.target.toLocaleString()}` : ''}
                                   </span>
                               </div>
                           ))}
                       </div>
                   ) : !error && !isLoading && activeCompetition ? (
                       <p className="text-muted-foreground text-sm">No targets set for your pod today.</p>
                   ) : null }
               </CardContent>
            </Card>
      </div>


      {/* Leaderboards Section */}
      <div className="grid gap-6 md:grid-cols-2">
          {isLoading ? (
               <>
                  <Skeleton className="h-[400px] w-full" />
                  <Skeleton className="h-[400px] w-full" />
               </>
           ) : (
               <>
                  {teamLeaderboard.length > 0 ? (
                      <Leaderboard title="Team Leaderboard" entries={teamLeaderboard} description="Current Competition Ranking" />
                  ) : !error && !isLoading && activeCompetition && teams.length > 0 ? (
                     <Card className="h-[400px] flex items-center justify-center shadow-md"><CardContent className="text-muted-foreground text-center">No team data available yet for the current competition.</CardContent></Card>
                  ) : !error && !isLoading && activeCompetition && teams.length === 0 ? (
                      <Card className="h-[400px] flex items-center justify-center shadow-md"><CardContent className="text-muted-foreground text-center">No teams defined for the current competition.</CardContent></Card>
                  ) : null}

                   {agentLeaderboard.length > 0 ? (
                       <Leaderboard title="Agent Leaderboard" entries={agentLeaderboard} description="Current Competition Ranking" />
                   ) : !error && !isLoading && activeCompetition && podAgents.length > 0 ? (
                     <Card className="h-[400px] flex items-center justify-center shadow-md"><CardContent className="text-muted-foreground text-center">No agent data available yet for the current competition.</CardContent></Card>
                   ) : !error && !isLoading && activeCompetition && podAgents.length === 0 ? (
                       <Card className="h-[400px] flex items-center justify-center shadow-md"><CardContent className="text-muted-foreground text-center">No agents found in your pod for this competition.</CardContent></Card>
                  ) : null}

                    {error === "No active competition found for your pod today." && !isLoading && (
                         <Card className="md:col-span-2 h-[100px] flex items-center justify-center shadow-md"><CardContent className="text-muted-foreground text-center">No competition is currently active for your pod.</CardContent></Card>
                    )}
               </>
           )}
      </div>
    </div>
  );
}
