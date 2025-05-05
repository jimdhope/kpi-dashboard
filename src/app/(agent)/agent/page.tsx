'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Leaderboard } from '@/components/leaderboard';
import { Target, Medal, Trophy, ClipboardList, AlertCircle, CalendarIcon, Loader2, Activity } from 'lucide-react'; // Added icons
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription as UIDescription } from "@/components/ui/alert"; // Ensure AlertDescription is aliased or imported uniquely
import { collection, query, where, getDocs, Timestamp, doc, getDoc, orderBy, onSnapshot, Unsubscribe, setDoc, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore'; // Added Firestore save/delete functions
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
        default: return {}; // No special style for other ranks
    }
};

export default function AgentDashboardPage() {
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
  const [achievementInputs, setAchievementInputs] = useState<AgentAchievementInputState>({});
  const [isSaving, setIsSaving] = useState<{ [key: string]: boolean }>({});

  // Listeners declared outside useEffect to be accessible in cleanup
  let unsubscribeAgents: Unsubscribe | null = null;
  let unsubscribeCompetition: Unsubscribe | null = null;
  let unsubscribeUserLogs: Unsubscribe | null = null;
  let unsubscribePodLogs: Unsubscribe | null = null;
  let unsubscribeTargets: Unsubscribe | null = null;
  let unsubscribeDailyAchievements: Unsubscribe | null = null;


  // 1. Get current user and their pod ID (using onSnapshot for real-time updates)
  useEffect(() => {
    setIsLoadingUser(true);
    console.log("[AgentDashboard] Setting up auth listener...");
    let unsubscribeUserDoc: Unsubscribe | null = null; // Declare outside the callback

    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      // Cleanup previous user doc listener if exists
      if (unsubscribeUserDoc) {
        console.log("[AgentDashboard] Cleaning up previous user doc listener.");
        unsubscribeUserDoc();
        unsubscribeUserDoc = null; // Reset it
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
  }, []); // Run only once on initial mount


  // Function to fetch and listen to daily achievements for the CURRENT date
    const fetchAndListenDailyAchievements = useCallback((competitionId: string | null, currentRules: RuleFormData[]) => {
        const currentDate = startOfDay(new Date()); // Always use the current date

        if (!competitionId || !currentUser?.id || !agentPodId) {
             console.log("[fetchAndListenDailyAchievements] Skipping: Missing required IDs or competition.");
             setAchievementInputs({}); // Clear inputs if no competition
             return;
         };

        console.log(`[fetchAndListenDailyAchievements] Setting up listener for competition ${competitionId}, date ${currentDate.toISOString().split('T')[0]}`);

        const dailyAchievementsRef = collection(db, 'dailyAchievements');
        const dateTimestamp = Timestamp.fromDate(currentDate);
        const dailyQuery = query(
            dailyAchievementsRef,
            where('agentId', '==', currentUser.id),
            where('podId', '==', agentPodId),
            where('date', '==', dateTimestamp),
            where('competitionId', '==', competitionId)
        );

        // Clean up previous listener first
        if (unsubscribeDailyAchievements) unsubscribeDailyAchievements();

        unsubscribeDailyAchievements = onSnapshot(dailyQuery, (snapshot) => {
            console.log(`[fetchAndListenDailyAchievements] Listener updated, found ${snapshot.docs.length} logs for ${currentDate.toISOString().split('T')[0]}`);
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
        // No cleanup return here, managed by the main effect
    }, [currentUser?.id, agentPodId]); // Dependencies for useCallback


  // 3. Fetch Competition Data, Pod Agents, and setup Log/Target Listeners
  useEffect(() => {
    let isMounted = true; // Track mount status for this effect
    console.log(`[AgentDashboard] Data Effect triggered: isLoadingUser=${isLoadingUser}, agentPodId=${agentPodId}, currentUser=${!!currentUser}`);

    if (!agentPodId || !currentUser?.id || isLoadingUser) {
        console.log("[AgentDashboard] Data Effect: Skipping/Cleaning up, prerequisites not met.");
        // Clean up listeners if context is lost mid-run
        if (unsubscribeAgents) unsubscribeAgents();
        if (unsubscribeUserLogs) unsubscribeUserLogs();
        if (unsubscribePodLogs) unsubscribePodLogs();
        if (unsubscribeTargets) unsubscribeTargets();
        if (unsubscribeDailyAchievements) unsubscribeDailyAchievements();
        unsubscribeAgents = null;
        unsubscribeCompetition = null;
        unsubscribeUserLogs = null;
        unsubscribePodLogs = null;
        unsubscribeTargets = null;
        unsubscribeDailyAchievements = null;
        // Reset states if prerequisites are not met after initial load
        if (!isLoadingUser) {
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
        return; // Exit early
    }

    console.log("[AgentDashboard] Data Effect: Starting data fetch and listeners for pod:", agentPodId);
    setIsLoadingData(true); // Indicate loading starts


    // --- Setup Pod Agents Listener ---
    console.log("[AgentDashboard] Data Effect: Setting up agents listener for pod:", agentPodId);
    const usersRef = collection(db, 'users');
    const agentsQuery = query(usersRef, where('podId', '==', agentPodId), where('roles', 'array-contains', 'agent'), orderBy('name'));

    // Ensure previous listener is cleaned up
    if (unsubscribeAgents) unsubscribeAgents();

    unsubscribeAgents = onSnapshot(agentsQuery, (agentsSnapshot) => {
         if (!isMounted) return; // Check if component is still mounted

         const fetchedAgents = agentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));

          // Compare IDs before setting state to prevent unnecessary re-renders
         setPodAgents(currentAgents => {
             const currentAgentIds = currentAgents.map(a => a.id).sort().join(',');
             const fetchedAgentIds = fetchedAgents.map(a => a.id).sort().join(',');
             if (currentAgentIds !== fetchedAgentIds) {
                  console.log("[AgentDashboard] Pod agents listener updated, found:", fetchedAgents.length);
                 return fetchedAgents;
             }
             console.log("[AgentDashboard] Pod agents listener updated, no change in agents.");
             return currentAgents; // No change
         });
    }, (err) => {
        if (!isMounted) return;
        console.error("[AgentDashboard] Error listening to pod agents:", err);
        setError("Failed to load pod member data.");
        setIsLoadingData(false);
    });


    // --- Setup Competition Listener ---
    console.log("[AgentDashboard] Data Effect: Setting up competition listener for pod:", agentPodId);
    const competitionsRef = collection(db, 'competitions');
    const todayTimestamp = Timestamp.fromDate(startOfDay(new Date())); // Use current date for competition check
    const competitionQuery = query(
      competitionsRef,
      where('podIds', 'array-contains', agentPodId),
      where('startDate', '<=', todayTimestamp),
      orderBy('startDate', 'desc')
    );

    // Ensure previous listener is cleaned up
    if (unsubscribeCompetition) unsubscribeCompetition();

    unsubscribeCompetition = onSnapshot(competitionQuery, (competitionSnapshot) => {
      if (!isMounted) return; // Check if component is still mounted
      console.log(`[AgentDashboard] Data Effect: Competition listener triggered. Found ${competitionSnapshot.docs.length} potential competitions.`);
      let foundActiveCompetition: CompetitionWithRules | null = null;
      for (const docSnap of competitionSnapshot.docs) {
        const comp = { id: docSnap.id, ...docSnap.data() } as CompetitionWithRules;
         // Ensure endDate exists and is a Timestamp before calling toDate()
        if (comp.endDate && comp.endDate instanceof Timestamp && comp.endDate.toDate() >= todayTimestamp) {
          foundActiveCompetition = comp;
          console.log("[AgentDashboard] Data Effect: Found active competition:", comp.id, comp.name);
          break;
        }
      }

       // Compare IDs to avoid unnecessary state updates and listener resets
      setActiveCompetition(currentActiveComp => {
         if (foundActiveCompetition?.id !== currentActiveComp?.id) {
             console.log(`[AgentDashboard] Active competition changed from ${currentActiveComp?.id ?? 'None'} to: ${foundActiveCompetition?.id ?? 'None'}`);
             // Cleanup old listeners before setting up new ones
             if (unsubscribeUserLogs) { console.log("[AgentDashboard] Data Effect: Cleaning up old user logs listener"); unsubscribeUserLogs(); unsubscribeUserLogs = null; }
             if (unsubscribePodLogs) { console.log("[AgentDashboard] Data Effect: Cleaning up old pod logs listener"); unsubscribePodLogs(); unsubscribePodLogs = null; }
             if (unsubscribeTargets) { console.log("[AgentDashboard] Data Effect: Cleaning up old targets listener"); unsubscribeTargets(); unsubscribeTargets = null; }
             if (unsubscribeDailyAchievements) { console.log("[AgentDashboard] Data Effect: Cleaning up old daily achievements listener"); unsubscribeDailyAchievements(); unsubscribeDailyAchievements = null;}

              if (foundActiveCompetition) {
                 const activeCompId = foundActiveCompetition.id;
                 const activeCompRules = (foundActiveCompetition.rules || []).filter(rule => rule.name.toLowerCase() !== 'bonus');
                 setRules(activeCompRules);
                 setTeams(foundActiveCompetition.teams || []);
                 console.log(`[AgentDashboard] Data Effect: Set ${activeCompRules.length} rules and ${foundActiveCompetition.teams?.length ?? 0} teams for competition ${activeCompId}`);


                 const achievementsRef = collection(db, 'dailyAchievements');
                 const compStartDate = foundActiveCompetition.startDate; // Use competition start date

                  // --- User Logs Listener (for ENTIRE competition) ---
                  console.log("[AgentDashboard] Data Effect: Setting up user logs listener for competition:", activeCompId);
                  const userLogsQuery = query(
                    achievementsRef,
                    where('agentId', '==', currentUser.id),
                    where('podId', '==', agentPodId!), // Add non-null assertion as it's checked above
                    where('competitionId', '==', activeCompId),
                     where('date', '>=', compStartDate) // Filter from competition start
                     // No end date filter needed here if we only care about active comp
                   );
                   unsubscribeUserLogs = onSnapshot(userLogsQuery, (snapshot) => {
                       if (!isMounted) return;
                       const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
                       console.log(`[AgentDashboard] User logs listener updated, found ${logs.length} logs for competition ${activeCompId}.`);
                       setDailyLogs(logs);
                   }, (err) => { if (isMounted) { console.error("[AgentDashboard] Error listening to user logs:", err); setError("Failed to load your scores."); } });


                 // --- Pod Logs Listener (for ENTIRE competition) ---
                 console.log("[AgentDashboard] Data Effect: Setting up pod logs listener for competition:", activeCompId);
                 const podLogsQuery = query(
                    achievementsRef,
                    where('podId', '==', agentPodId!), // Add non-null assertion
                    where('competitionId', '==', activeCompId),
                     where('date', '>=', compStartDate) // Filter from competition start
                     // No end date filter needed
                   );
                  unsubscribePodLogs = onSnapshot(podLogsQuery, (snapshot) => {
                       if (!isMounted) return;
                       const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
                       console.log(`[AgentDashboard] Pod logs listener updated, found ${logs.length} logs for competition ${activeCompId}.`);
                       setPodLogs(logs);
                  }, (err) => { if (isMounted) { console.error("[AgentDashboard] Error listening to pod logs:", err); setError("Failed to load pod scores."); } });


                 // --- Targets Listener ---
                 const targetsDocId = `${activeCompId}_${agentPodId}`;
                 console.log("[AgentDashboard] Data Effect: Setting up targets listener for doc:", targetsDocId);
                 const targetsDocRef = doc(db, 'dailyPodTargets', targetsDocId);
                  // Ensure previous listener is cleaned up
                 if (unsubscribeTargets) unsubscribeTargets();
                  unsubscribeTargets = onSnapshot(targetsDocRef, (docSnap) => {
                       if (!isMounted) return;
                       const targetData = docSnap.exists() ? docSnap.data() as DailyTargetData : null;
                       console.log(`[AgentDashboard] Targets listener updated, target doc exists: ${docSnap.exists()}, Data:`, targetData);
                       setDailyTargets(targetData);
                  }, (err) => { if (isMounted) { console.error("[AgentDashboard] Error listening to daily targets:", err); setError("Failed to load targets."); } });


                 // --- Initial Fetch and Listener Setup for Daily Achievements (for CURRENT date) ---
                 fetchAndListenDailyAchievements(activeCompId, activeCompRules);

             } else {
                 console.log("[AgentDashboard] Data Effect: No active competition found.");
                 setRules([]);
                 setTeams([]);
                 setDailyLogs([]);
                 setPodLogs([]);
                 setDailyTargets(null);
                 setAchievementInputs({});
                  // Set specific error only if no critical user error exists
                 setError(prevError =>
                    prevError === "You are not currently assigned to a pod. Some features may be unavailable." || prevError === "Could not find your user profile data." || prevError === "You must be logged in." || prevError === "Failed to load your profile information."
                    ? prevError
                    : "No active competition found for your pod today."
                 );
             }
              setIsLoadingData(false); // Mark data loading complete after finding (or not finding) competition
             console.log("[AgentDashboard] Data Effect: Data loading state set to false.");
             return foundActiveCompetition; // Return the new value for setActiveCompetition
         }
         // If competition ID hasn't changed, return the current state
         console.log("[AgentDashboard] Data Effect: Active competition ID hasn't changed.");
         return currentActiveComp;
      });

    }, (err) => {
      if (!isMounted) return;
      console.error("[AgentDashboard] Error listening to competitions:", err);
      setError("Failed to load competition data.");
      setIsLoadingData(false);
      // Ensure all listeners are cleaned up on error
      if (unsubscribeAgents) unsubscribeAgents();
      if (unsubscribeCompetition) unsubscribeCompetition();
      if (unsubscribeUserLogs) unsubscribeUserLogs();
      if (unsubscribePodLogs) unsubscribePodLogs();
      if (unsubscribeTargets) unsubscribeTargets();
      if (unsubscribeDailyAchievements) unsubscribeDailyAchievements();
        unsubscribeAgents = null;
        unsubscribeCompetition = null;
        unsubscribeUserLogs = null;
        unsubscribePodLogs = null;
        unsubscribeTargets = null;
        unsubscribeDailyAchievements = null;
    });

    // Cleanup function
    return () => {
      isMounted = false; // Mark as unmounted
      console.log("[AgentDashboard] Data Effect: Cleaning up ALL listeners.");
      if (unsubscribeAgents) unsubscribeAgents();
      if (unsubscribeCompetition) unsubscribeCompetition();
      if (unsubscribeUserLogs) unsubscribeUserLogs();
      if (unsubscribePodLogs) unsubscribePodLogs();
      if (unsubscribeTargets) unsubscribeTargets();
      if (unsubscribeDailyAchievements) unsubscribeDailyAchievements();
       unsubscribeAgents = null;
        unsubscribeCompetition = null;
        unsubscribeUserLogs = null;
        unsubscribePodLogs = null;
        unsubscribeTargets = null;
        unsubscribeDailyAchievements = null;
    };
     // Dependencies: Re-run when user/pod context changes
  }, [agentPodId, currentUser?.id, isLoadingUser, fetchAndListenDailyAchievements]); // Pass fetchAndListen as dependency


  // 4. Process data (Scores, Leaderboards) - useMemo
  const { agentAchievements, podTargetSummary, agentLeaderboard, teamLeaderboard } = useMemo(() => {
    console.log(`[AgentDashboard] Memo triggered: Calculating data. Daily Logs: ${dailyLogs.length}, Pod Logs: ${podLogs.length}, Agents: ${podAgents.length}, Teams: ${teams.length}, Rules: ${rules.length}`);

    // --- Calculate Agent's *Competition* Score and Achievements ---
    let competitionTotalPoints = 0;
    const competitionAchievementsMap = new Map<string, { ruleId: string; name: string; emoji: string; value: number }>(); // Include ruleId

    if (currentUser && rules.length > 0) {
        dailyLogs.forEach(log => {
            const rule = rules.find(r => r.id === log.ruleId);
            if (rule) {
                const pointsToAdd = typeof log.points === 'number' && !isNaN(log.points) ? log.points : 0;
                competitionTotalPoints += pointsToAdd;

                const ruleKey = rule.id!;
                const currentRuleTotal = competitionAchievementsMap.get(ruleKey) || { ruleId: ruleKey, name: rule.name, emoji: rule.emoji || '❓', value: 0 };
                currentRuleTotal.value += log.value || 0;
                competitionAchievementsMap.set(ruleKey, currentRuleTotal);
            }
        });
    }
    const finalAgentCompetitionAchievements = Array.from(competitionAchievementsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
     console.log("[AgentDashboard] Memo: Calculated final agent competition achievements:", finalAgentCompetitionAchievements);

    const finalAgentAchievements : AgentScore = { totalPoints: competitionTotalPoints, achievements: finalAgentCompetitionAchievements };


    // --- Calculate Pod Target Summary for Today ---
    const dayOfWeek = daysOfWeek[getDay(new Date())]; // Always use current day
    const podRuleTotalsToday: Record<string, number> = {};
    rules.forEach(rule => { if (rule.id) podRuleTotalsToday[rule.id] = 0; });

     // Filter the POD logs for today's date
     const todayTimestampStart = startOfDay(new Date()); // Always use current date
     const todayPodLogs = podLogs.filter(log => {
         if (!log.date || !(log.date instanceof Timestamp)) return false;
         return startOfDay(log.date.toDate()).getTime() === todayTimestampStart.getTime();
     });
    console.log(`[AgentDashboard] Memo: Found ${todayPodLogs.length} logs for pod today.`);

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
             console.log(`[AgentDashboard] Memo: Target for Rule ${rule.name} (${rule.id}) on ${dayOfWeek}: ${targetValue}`);
            if (targetValue === undefined || targetValue === null) return null;
            const emojiToUse = rule.emoji && rule.emoji.trim() !== '' ? rule.emoji : '❓';
            return { ruleId: rule.id, ruleName: rule.name, ruleEmoji: emojiToUse, achieved: podRuleTotalsToday[rule.id] || 0, target: targetValue };
        })
        .filter((item): item is PodTargetSummary => item !== null)
        .sort((a, b) => a.ruleName.localeCompare(b.name));
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
        agentAchievements: finalAgentAchievements, // Renamed for clarity
        podTargetSummary: finalPodTargetSummary,
        agentLeaderboard: finalAgentLeaderboard,
        teamLeaderboard: finalTeamLeaderboard
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyLogs, podLogs, rules, dailyTargets, currentUser, podAgents, teams]); // Use current date directly, no selectedDate


  // --- Achievement Card Logic (Moved from achievements page) ---
  const handleValueChange = useCallback((ruleId: string, change: number) => {
    const currentValue = achievementInputs[ruleId]?.value ?? 0;
    const newValue = Math.max(0, currentValue + change);
    setAchievementInputs(prev => ({
      ...prev,
      [ruleId]: { ...prev[ruleId], value: newValue },
    }));
    debouncedSave(ruleId, newValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achievementInputs]); // Depend on achievementInputs to get the latest existingLogId

  const debounce = (func: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout | null = null; // Use NodeJS.Timeout or number
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
       // Critical: Read existingLogId *inside* the save handler from the *current* state
       const existingLogId = achievementInputs[ruleId]?.existingLogId;

      if (existingLogId) {
        const docRef = doc(achievementsRef, existingLogId);
         // Ensure we only update if the value is non-zero, or delete if it becomes zero
         if (value > 0) {
             await setDoc(docRef, logEntry, { merge: true });
             console.log(`Updated log ${existingLogId} for rule ${rule.name} to value ${value}`);
         } else {
             await deleteDoc(docRef);
             console.log(`Deleted log ${existingLogId} for rule ${rule.name} as value is 0`);
              // Remove existingLogId from state after deletion
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
          if (newState[ruleId]) newState[ruleId].existingLogId = addedDoc.id;
           else newState[ruleId] = { value: value, existingLogId: addedDoc.id }; // Handle case where input wasn't initialized yet
          return newState;
        });
      }
       // Implicitly handle value === 0 and no existingLogId: do nothing
    } catch (err) {
      console.error("Error saving achievement:", err);
      toast({ variant: "destructive", title: "Save Failed", description: `Could not save ${rule.name}.` });
       // Optional: Revert optimistic UI update on failure? - maybe not for auto-save
    } finally {
      setIsSaving(prev => ({ ...prev, [ruleId]: false }));
    }
  };

   const debouncedSave = useMemo(() => debounce(handleSaveAchievement, 1000),
     // eslint-disable-next-line react-hooks/exhaustive-deps
     [agentPodId, currentUser?.id, activeCompetition?.id, rules, toast, achievementInputs] // Dependencies updated
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
            <CardHeader>
                <CardTitle>Today's Achievements</CardTitle>
                <CardDescription>Use the buttons to log your achievements for today.</CardDescription>
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
                 ) : !canLog && !error && rules.length === 0 ? ( // Check rules length specifically
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
           <Card className="shadow-md lg:col-span-2"> {/* Span 2 columns on larger screens */}
             <CardHeader>
               <CardTitle className="flex items-center gap-2"> <Activity className="h-5 w-5"/> Your Scores</CardTitle>
               <CardDescription>Achievements logged for today and the entire competition.</CardDescription>
             </CardHeader>
             <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Daily Scores (Removed) */}
                  {/* Competition Scores */}
                   <div>
                      <h3 className="text-lg font-semibold mb-2">Competition Total</h3>
                       {isLoading ? (
                           <div className="space-y-2">
                                <Skeleton className="h-6 w-1/4 rounded mb-1" />
                                <Skeleton className="h-4 w-full rounded" />
                                <Skeleton className="h-4 w-5/6 rounded" />
                           </div>
                       ) : agentAchievements ? (
                           <>
                                <div className="text-2xl font-bold text-primary mb-2">{agentAchievements.totalPoints.toLocaleString()} pts</div>
                                {agentAchievements.achievements.length > 0 ? (
                                    <div className="space-y-1 text-sm">
                                        {agentAchievements.achievements.map(ach => (
                                            // Added key prop here
                                            <div key={ach.ruleId} className="flex items-center justify-between">
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
                           <p className="text-muted-foreground">Could not load competition scores.</p>
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
                   ) : !error && !isLoading && activeCompetition ? ( // Show only if there's an active competition but no targets
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
                  ) : !error && !isLoading && activeCompetition && teams.length > 0 ? ( // Show only if teams exist but no scores yet
                     <Card className="h-[400px] flex items-center justify-center shadow-md"><CardContent className="text-muted-foreground text-center">No team data available yet for the current competition.</CardContent></Card>
                  ) : !error && !isLoading && activeCompetition && teams.length === 0 ? ( // Show if no teams defined
                      <Card className="h-[400px] flex items-center justify-center shadow-md"><CardContent className="text-muted-foreground text-center">No teams defined for the current competition.</CardContent></Card>
                  ) : null}

                   {agentLeaderboard.length > 0 ? (
                       <Leaderboard title="Agent Leaderboard" entries={agentLeaderboard} description="Current Competition Ranking" />
                   ) : !error && !isLoading && activeCompetition && podAgents.length > 0 ? ( // Show only if agents exist but no scores yet
                     <Card className="h-[400px] flex items-center justify-center shadow-md"><CardContent className="text-muted-foreground text-center">No agent data available yet for the current competition.</CardContent></Card>
                   ) : !error && !isLoading && activeCompetition && podAgents.length === 0 ? ( // Show if no agents in pod
                       <Card className="h-[400px] flex items-center justify-center shadow-md"><CardContent className="text-muted-foreground text-center">No agents found in your pod for this competition.</CardContent></Card>
                  ) : null}

                    {error === "No active competition found for your pod today." && (
                         <Card className="md:col-span-2 h-[100px] flex items-center justify-center shadow-md"><CardContent className="text-muted-foreground text-center">No competition is currently active for your pod.</CardContent></Card>
                    )}
               </>
           )}
      </div>


    </div>
  );
}
