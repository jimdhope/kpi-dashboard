'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
// Removed KpiCard import
import { Leaderboard } from '@/components/leaderboard';
// import { getKPIs, KPI, Group } from '@/services/kpi'; // Removed KPI service import
import { Target, Medal, Trophy, ClipboardList, AlertCircle, CalendarIcon, Loader2 } from 'lucide-react'; // Added Loader2, CalendarIcon
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription as UIDescription } from "@/components/ui/alert";
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'; // Added Popover imports
import { Calendar } from '@/components/ui/calendar'; // Added Calendar import
import { Button } from '@/components/ui/button'; // Added Button import
import { Label } from '@/components/ui/label'; // Added Label import
import { collection, query, where, getDocs, Timestamp, doc, getDoc, orderBy, onSnapshot, Unsubscribe, setDoc, addDoc, serverTimestamp } from 'firebase/firestore'; // Added Firestore save functions
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
import { AchievementCard } from '@/components/achievement-card'; // Import the new card component

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
  score: number;
}
interface CompetitionWithRules extends Competition {
    teams?: any[];
    id: string; // Ensure CompetitionWithRules has an id
}
interface AgentScore { // Represents daily achievement totals for the agent
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
// New State Interface for Achievement Inputs
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
        default: return {};
    }
};

export default function AgentDashboardPage() {
  // Removed KPI state: const [kpis, setKpis] = useState<KPI[]>([]);
  // Removed KPI loading state: const [kpisLoading, setKpisLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // State for fetched data (Scores & Leaderboard)
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

  // New State for Achievement Logging (moved from achievements page)
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [achievementInputs, setAchievementInputs] = useState<AgentAchievementInputState>({});
  const [isSaving, setIsSaving] = useState<{ [key: string]: boolean }>({});

  // 1. Get current user and their pod ID (using onSnapshot for real-time updates)
  useEffect(() => {
    setIsLoadingUser(true);
    console.log("[AgentDashboard] Setting up auth listener...");
    let unsubscribeUserDoc: Unsubscribe = () => {}; // Declare outside the callback

    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      // Cleanup previous user doc listener if exists
      if (unsubscribeUserDoc) {
        console.log("[AgentDashboard] Cleaning up previous user doc listener.");
        unsubscribeUserDoc();
      }

      if (user) {
        console.log(`[AgentDashboard] Auth state changed: User found (UID: ${user.uid})`);
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => { // Assign to outer scope variable
          if (docSnap.exists()) {
            const userData = { id: docSnap.id, ...docSnap.data() } as AppUser;
            console.log("[AgentDashboard] User document snapshot received:", userData);
            setCurrentUser(userData);
            const newPodId = userData.podId || null;
            if (newPodId !== agentPodId) {
                 setAgentPodId(newPodId);
                 console.log("[AgentDashboard] Agent Pod ID set to:", newPodId);
                 if (!newPodId) {
                     console.warn("[AgentDashboard] User is not assigned to a pod.");
                     setError("You are not currently assigned to a pod. Some features may be unavailable.");
                 } else {
                    // Clear pod-related errors if pod is now assigned
                     setError(prevError => (prevError === "You are not currently assigned to a pod. Some features may be unavailable." ? null : prevError));
                 }
            }
          } else {
             console.error(`[AgentDashboard] User document not found in Firestore for UID: ${user.uid}`);
             setError("Could not find your user profile data.");
             setCurrentUser(null);
             setAgentPodId(null);
          }
           // Always set loading false after the first snapshot (or error)
           if(isLoadingUser) setIsLoadingUser(false);
          console.log("[AgentDashboard] User loading finished.");
        }, (err) => {
           console.error("[AgentDashboard] Error listening to user document:", err);
           setError("Failed to load your profile information.");
           setCurrentUser(null);
           setAgentPodId(null);
           setIsLoadingUser(false); // Ensure loading stops on error
        });
      } else {
         console.log("[AgentDashboard] Auth state changed: No user logged in.");
         setError("You must be logged in.");
         setCurrentUser(null);
         setAgentPodId(null);
         setIsLoadingUser(false); // Ensure loading stops
      }
    });
    return () => {
         console.log("[AgentDashboard] Cleaning up auth listener.");
         if (unsubscribeUserDoc) {
            console.log("[AgentDashboard] Cleaning up final user doc listener.");
            unsubscribeUserDoc();
        }
        unsubscribeAuth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Removed agentPodId, isLoadingUser

  // Removed KPI fetching useEffect

  // 3. Fetch Competition Data, Pod Agents, and setup Log/Target Listeners
  useEffect(() => {
    console.log(`[AgentDashboard] Data Effect triggered: isLoadingUser=${isLoadingUser}, agentPodId=${agentPodId}, currentUser=${!!currentUser}`);
    if (!agentPodId || !currentUser?.id || isLoadingUser) {
        console.log("[AgentDashboard] Data Effect: Skipping data fetch, prerequisites not met.");
        if (!isLoadingUser) {
            setIsLoadingData(false);
            setActiveCompetition(null); // Clear competition if prerequisites lost
            setRules([]);
            setTeams([]);
            setPodAgents([]);
            setDailyLogs([]);
            setPodLogs([]);
            setDailyTargets(null);
            setAchievementInputs({}); // Clear achievement inputs
        }
        return () => {};
    }

    console.log("[AgentDashboard] Data Effect: Starting data fetch and listeners for pod:", agentPodId);
    setIsLoadingData(true);

    let unsubscribeAgents: Unsubscribe = () => {};
    let unsubscribeCompetition: Unsubscribe | null = null;
    let unsubscribeUserLogs: Unsubscribe = () => {};
    let unsubscribePodLogs: Unsubscribe = () => {};
    let unsubscribeTargets: Unsubscribe = () => {};
    let unsubscribeDailyAchievements: Unsubscribe = () => {}; // Listener for daily achievements

    // --- Setup Pod Agents Listener ---
    console.log("[AgentDashboard] Data Effect: Setting up agents listener for pod:", agentPodId);
    const usersRef = collection(db, 'users');
    const agentsQuery = query(usersRef, where('podId', '==', agentPodId), where('roles', 'array-contains', 'agent'), orderBy('name'));
    unsubscribeAgents = onSnapshot(agentsQuery, (agentsSnapshot) => {
        const fetchedAgents = agentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
        setPodAgents(currentAgents => {
            const currentAgentIds = currentAgents.map(a => a.id).sort().join(',');
            const fetchedAgentIds = fetchedAgents.map(a => a.id).sort().join(',');
            if (currentAgentIds !== fetchedAgentIds) {
                console.log("[AgentDashboard] Pod agents listener updated, found:", fetchedAgents.length);
                return fetchedAgents;
            }
            return currentAgents; // No change
        });
    }, (err) => {
        console.error("[AgentDashboard] Error listening to pod agents:", err);
        setError("Failed to load pod member data.");
        setIsLoadingData(false);
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

    unsubscribeCompetition = onSnapshot(competitionQuery, (competitionSnapshot) => {
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

      // --- If Active Competition Changes ---
      if (foundActiveCompetition?.id !== activeCompetition?.id) {
        console.log(`[AgentDashboard] Active competition changed to: ${foundActiveCompetition?.id ?? 'None'}`);
        setActiveCompetition(foundActiveCompetition); // Update active competition state

        // Cleanup old listeners
        unsubscribeUserLogs();
        unsubscribePodLogs();
        unsubscribeTargets();
        unsubscribeDailyAchievements(); // Cleanup daily achievement listener too

        if (foundActiveCompetition) {
          const activeCompId = foundActiveCompetition.id;
          const activeCompRules = (foundActiveCompetition.rules || []).filter(rule => rule.name.toLowerCase() !== 'bonus'); // Filter rules here
          setRules(activeCompRules);
          setTeams(foundActiveCompetition.teams || []);

          const achievementsRef = collection(db, 'dailyAchievements');

          // Setup new listeners for the new active competition
          console.log("[AgentDashboard] Data Effect: Setting up new user logs listener for competition:", activeCompId);
          const userLogsQuery = query(achievementsRef, where('agentId', '==', currentUser.id), where('podId', '==', agentPodId), where('competitionId', '==', activeCompId));
          unsubscribeUserLogs = onSnapshot(userLogsQuery, (snapshot) => {
            setDailyLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog)));
          }, (err) => { console.error("[AgentDashboard] Error listening to user logs:", err); setError("Failed to load your scores."); });

          console.log("[AgentDashboard] Data Effect: Setting up new pod logs listener for competition:", activeCompId);
          const podLogsQuery = query(achievementsRef, where('podId', '==', agentPodId), where('competitionId', '==', activeCompId));
          unsubscribePodLogs = onSnapshot(podLogsQuery, (snapshot) => {
            setPodLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog)));
          }, (err) => { console.error("[AgentDashboard] Error listening to pod logs:", err); setError("Failed to load pod scores."); });

          const targetsDocId = `${activeCompId}_${agentPodId}`;
          console.log("[AgentDashboard] Data Effect: Setting up new targets listener for doc:", targetsDocId);
          const targetsDocRef = doc(db, 'dailyPodTargets', targetsDocId);
          unsubscribeTargets = onSnapshot(targetsDocRef, (docSnap) => {
            setDailyTargets(docSnap.exists() ? docSnap.data() as DailyTargetData : null);
          }, (err) => { console.error("[AgentDashboard] Error listening to daily targets:", err); setError("Failed to load targets."); });

           // Initial fetch & listener for *today's* achievements for the cards
           fetchAndListenDailyAchievements(activeCompId, activeCompRules); // Pass filtered rules

        } else {
            console.log("[AgentDashboard] Data Effect: No active competition found.");
            setRules([]);
            setTeams([]);
            setDailyLogs([]);
            setPodLogs([]);
            setDailyTargets(null);
            setAchievementInputs({}); // Clear achievement inputs
             // Set specific error only if no critical user error exists
            setError(prevError =>
                prevError === "You are not currently assigned to a pod." || prevError === "Could not find your user profile." || prevError === "You must be logged in." || prevError === "Failed to load your profile information."
                ? prevError
                : "No active competition found for your pod today."
            );
        }
        setIsLoadingData(false); // Mark data loading complete
        console.log("[AgentDashboard] Data Effect: Data loading state set to false.");
      }
    }, (err) => {
      console.error("[AgentDashboard] Error listening to competitions:", err);
      setError("Failed to load competition data.");
      setIsLoadingData(false);
      unsubscribeAgents();
      unsubscribeUserLogs();
      unsubscribePodLogs();
      unsubscribeTargets();
      unsubscribeDailyAchievements();
    });

    // --- Fetch & Listen to Daily Achievements (for the cards) ---
    const fetchAndListenDailyAchievements = (competitionId: string, currentRules: RuleFormData[]) => {
        console.log(`[AgentDashboard] Setting up daily achievements listener for competition ${competitionId} and date ${selectedDate.toISOString().split('T')[0]}`);
        if (!currentUser?.id || !agentPodId) return; // Guard clause

        const dailyAchievementsRef = collection(db, 'dailyAchievements');
        const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
        const dailyQuery = query(
            dailyAchievementsRef,
            where('agentId', '==', currentUser.id),
            where('podId', '==', agentPodId),
            where('date', '==', dateTimestamp),
            where('competitionId', '==', competitionId) // Ensure correct competition
        );

        // Clean up previous listener first
        if (unsubscribeDailyAchievements) unsubscribeDailyAchievements();

        unsubscribeDailyAchievements = onSnapshot(dailyQuery, (snapshot) => {
            console.log(`[AgentDashboard] Daily achievements listener updated, found ${snapshot.docs.length} logs for ${selectedDate.toISOString().split('T')[0]}`);
            const existingAchievements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
            const initialInputs: AgentAchievementInputState = {};
            currentRules.forEach(rule => { // Use currentRules passed to function
                if (!rule.id) return;
                const existingLog = existingAchievements.find(log => log.ruleId === rule.id);
                initialInputs[rule.id] = {
                    value: existingLog ? existingLog.value : 0,
                    existingLogId: existingLog?.id,
                };
            });
            setAchievementInputs(initialInputs);
        }, (err) => {
            console.error("Error listening to daily achievements:", err);
            setError("Failed to load today's achievements.");
            setAchievementInputs({});
        });
    };

    // Initial call for today's achievements if competition is already active
     if (activeCompetition && rules.length > 0) {
        fetchAndListenDailyAchievements(activeCompetition.id, rules);
     }

    // Cleanup function
    return () => {
      console.log("[AgentDashboard] Data Effect: Cleaning up ALL listeners.");
      unsubscribeAgents();
      unsubscribeCompetition?.(); // Use optional chaining
      unsubscribeUserLogs();
      unsubscribePodLogs();
      unsubscribeTargets();
      unsubscribeDailyAchievements();
    };
  }, [agentPodId, currentUser?.id, isLoadingUser, selectedDate]); // Add selectedDate as dependency

  // 4. Process data (Scores, Leaderboards) - useMemo
  const { agentAchievements, podTargetSummary, agentLeaderboard, teamLeaderboard } = useMemo(() => {
    console.log(`[AgentDashboard] Memo triggered: Calculating data. Daily Logs: ${dailyLogs.length} Pod Logs: ${podLogs.length} Agents: ${podAgents.length} Teams: ${teams.length} Rules: ${rules.length}`);

    // --- Calculate Agent's *Competition* Score and Achievements ---
    let competitionTotalPoints = 0;
    const competitionAchievements: { ruleId: string; ruleName: string; ruleEmoji: string; value: number }[] = [];
    const ruleTotalsMap = new Map<string, { name: string; emoji: string; value: number }>();

    if (currentUser && rules.length > 0) {
        // Iterate over all logs for the user within the competition period
        dailyLogs.forEach(log => {
            const rule = rules.find(r => r.id === log.ruleId);
            if (rule) {
                const pointsToAdd = typeof log.points === 'number' && !isNaN(log.points) ? log.points : 0;
                competitionTotalPoints += pointsToAdd;

                const ruleKey = rule.id!;
                const currentRuleTotal = ruleTotalsMap.get(ruleKey) || { name: rule.name, emoji: rule.emoji || '❓', value: 0 };
                currentRuleTotal.value += log.value || 0;
                ruleTotalsMap.set(ruleKey, currentRuleTotal);
            }
        });

        // Convert map to array and sort
        competitionAchievements.push(...Array.from(ruleTotalsMap.values()));
        competitionAchievements.sort((a, b) => a.name.localeCompare(b.name));
    }
     console.log("[AgentDashboard] Memo: Calculated final agent competition achievements:", competitionAchievements);

    // --- Calculate Pod Target Summary for Today ---
    const dayOfWeek = daysOfWeek[getDay(new Date())]; // Use today's date, not selectedDate
    const podRuleTotalsToday: Record<string, number> = {};
    rules.forEach(rule => { if (rule.id) podRuleTotalsToday[rule.id] = 0; });

    // Filter podLogs specifically for *today* for the target summary
    const todayTimestampStart = startOfDay(new Date());
    const todayPodLogs = podLogs.filter(log => log.date && log.date.toDate && log.date.toDate() >= todayTimestampStart);
    console.log(`[AgentDashboard] Memo: Found ${todayPodLogs.length} logs for pod today for target summary.`);

    todayPodLogs.forEach(log => {
        if (podRuleTotalsToday.hasOwnProperty(log.ruleId)) {
             const valueToAdd = typeof log.value === 'number' && !isNaN(log.value) ? log.value : 0;
            podRuleTotalsToday[log.ruleId] += valueToAdd;
        }
     });

    const finalPodTargetSummary: PodTargetSummary[] = rules
        .map(rule => {
            if (!rule.id) return null;
            const targetValue = dailyTargets?.[rule.id]?.[dayOfWeek];
            // Only include if target is set for today
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
        agentAchievements: { totalPoints: competitionTotalPoints, achievements: competitionAchievements }, // Return competition-wide achievements
        podTargetSummary: finalPodTargetSummary,
        agentLeaderboard: finalAgentLeaderboard,
        teamLeaderboard: finalTeamLeaderboard
    };
  }, [dailyLogs, podLogs, rules, dailyTargets, currentUser, podAgents, teams]);


  // --- Achievement Card Logic (Moved from achievements page) ---
  const handleValueChange = (ruleId: string, change: number) => {
    const currentValue = achievementInputs[ruleId]?.value ?? 0;
    const newValue = Math.max(0, currentValue + change);
    setAchievementInputs(prev => ({
      ...prev,
      [ruleId]: { ...prev[ruleId], value: newValue },
    }));
    debouncedSave(ruleId, newValue);
  };

  const debounce = (func: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  };

  const handleSaveAchievement = async (ruleId: string, value: number) => {
    if (!agentPodId || !currentUser?.id || !activeCompetition?.id) {
      console.error("Required info missing for save.");
      return;
    }
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;

    setIsSaving(prev => ({ ...prev, [ruleId]: true }));
    try {
      const points = rule.points * value;
      const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
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
        await setDoc(docRef, logEntry, { merge: true });
      } else if (value > 0) {
        const addedDoc = await addDoc(achievementsRef, logEntry);
        setAchievementInputs(prev => {
          const newState = { ...prev };
          if (newState[ruleId]) newState[ruleId].existingLogId = addedDoc.id;
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
    // Ensure dependencies are correct and stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agentPodId, currentUser?.id, activeCompetition?.id, rules, achievementInputs, selectedDate, toast]
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

      {/* Scores and Targets Section */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          {/* Your Scores Card */}
           <Card className="shadow-md">
             <CardHeader>
               <CardTitle className="flex items-center gap-2"> <ClipboardList className="h-5 w-5"/> Your Scores (Competition)</CardTitle>
               <CardDescription>Total points and achievements during the current competition.</CardDescription>
             </CardHeader>
             <CardContent>
                {isLoading ? (
                    <div className="space-y-3">
                         <Skeleton className="h-8 w-1/4 rounded mb-2" />
                         <Skeleton className="h-4 w-full rounded" />
                         <Skeleton className="h-4 w-5/6 rounded" />
                    </div>
                ) : agentAchievements ? (
                    <>
                        <div className="text-3xl font-bold text-primary mb-2">{agentAchievements.totalPoints.toLocaleString()} pts</div>
                        {agentAchievements.achievements.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                {agentAchievements.achievements.map(ach => (
                                    <div key={ach.ruleId} className="flex items-center justify-between sm:justify-start sm:gap-2">
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
                     <p className="text-muted-foreground">Could not load your scores.</p>
                 ) : null}
             </CardContent>
           </Card>

           {/* Pod Target Summary Card */}
           <Card className="shadow-md">
              <CardHeader>
                   <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5"/> Pod Targets Today</CardTitle>
                   <CardDescription>Track your pod's progress towards today's targets.</CardDescription>
              </CardHeader>
              <CardContent>
                   {isLoading ? (
                        <div className="space-y-2">
                           <Skeleton className="h-4 w-full rounded" />
                           <Skeleton className="h-4 w-5/6 rounded" />
                           <Skeleton className="h-4 w-3/4 rounded" />
                        </div>
                    ) : podTargetSummary.length > 0 ? (
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                           {podTargetSummary.map(summary => (
                               <div key={summary.ruleId} className="flex items-center justify-between sm:justify-start sm:gap-2 whitespace-nowrap">
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
                   ) : !error && !isLoading ? (
                       <p className="text-muted-foreground">No targets set for your pod today.</p>
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
                  ) : !error && !isLoading && rules.length > 0 ? (
                     <Card className="h-[400px] flex items-center justify-center shadow-md"><CardContent className="text-muted-foreground text-center">No team data available for the current competition.</CardContent></Card>
                  ) : null}
                   {agentLeaderboard.length > 0 ? (
                       <Leaderboard title="Agent Leaderboard" entries={agentLeaderboard} description="Current Competition Ranking" />
                   ) : !error && !isLoading && rules.length > 0 ? (
                     <Card className="h-[400px] flex items-center justify-center shadow-md"><CardContent className="text-muted-foreground text-center">No agent data available for the current competition.</CardContent></Card>
                   ) : null}
                    {error === "No active competition found for your pod today." && (
                         <Card className="md:col-span-2 h-[100px] flex items-center justify-center shadow-md"><CardContent className="text-muted-foreground text-center">No competition is currently active for your pod.</CardContent></Card>
                    )}
               </>
           )}
      </div>

       {/* Log Achievements Section */}
        <Card>
            <CardHeader>
                <CardTitle>Log Achievements ({format(selectedDate, 'PPP')})</CardTitle>
                <CardDescription>Use the buttons to log your achievements for the selected date.</CardDescription>
                 {/* Date Picker for Logging */}
                 <div className="pt-4">
                    <Label htmlFor="log-date-select">Select Date to Log For</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="log-date-select"
                          variant={"outline"}
                          className={cn(
                            "w-full sm:w-[240px] justify-start text-left font-normal mt-2",
                            !selectedDate && "text-muted-foreground"
                          )}
                          disabled={isLoading}
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
                ) : !canLog && !error ? (
                    <p className="text-muted-foreground text-center py-6">
                        {rules.length === 0 ? "No active competition or rules found for your pod on this date." : "Loading data..."}
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

    </div>
  );
}