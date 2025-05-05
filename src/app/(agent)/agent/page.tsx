
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { KpiCard } from '@/components/kpi-card';
import { Leaderboard } from '@/components/leaderboard';
import { getKPIs, KPI, Group } from '@/services/kpi';
import { DollarSign, Target, Users, Medal, Trophy, ClipboardList, AlertCircle } from 'lucide-react'; // Added icons
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription as UIDescription } from "@/components/ui/alert"; // Renamed import
import { collection, query, where, getDocs, Timestamp, doc, getDoc, orderBy, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { DailyAchievementLog } from '@/app/(admin)/admin/log-achievements/page'; // Ensure correct path
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog'; // Ensure correct path
import type { DailyTargetData } from '@/app/(admin)/admin/pod-targets/page'; // Ensure correct path
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

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
  score: number; // Add score property explicitly
}
interface CompetitionWithRules extends Competition {
    teams?: any[]; // Add optional teams field
}
interface AgentScore {
  agentId: string;
  agentFirstName: string;
  totalPoints: number;
  emojiString: string;
}
interface PodTargetSummary {
  ruleId: string;
  ruleName: string;
  ruleEmoji: string;
  achieved: number;
  target: number | null;
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
        case 1: return { backgroundColor: '#9f8f5e', color: '#ffffff' }; // Gold-ish background, white text
        case 2: return { backgroundColor: '#969696', color: '#ffffff' }; // Silver-ish background, white text
        case 3: return { backgroundColor: '#996b4f', color: '#ffffff' }; // Bronze-ish background, white text
        default: return {}; // No special style for other ranks
    }
};


const kpiIcons: { [key: string]: React.ReactNode } = {
  'Sales': <DollarSign className="h-4 w-4" />,
  'Customer Acquisition': <Target className="h-4 w-4" />,
  'Sales (Test Pod)': <DollarSign className="h-4 w-4 text-blue-500" />, // Example differentiating icon
  'Customer Response Time': <Users className="h-4 w-4 text-green-500" />, // Example differentiating icon
  // Add other KPI icons as needed
};

export default function AgentDashboardPage() {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [kpisLoading, setKpisLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // State for fetched data (Scores & Leaderboard)
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [agentPodId, setAgentPodId] = useState<string | null>(null);
  const [rules, setRules] = useState<RuleFormData[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyAchievementLog[]>([]); // Logs for the current user
  const [podLogs, setPodLogs] = useState<DailyAchievementLog[]>([]); // Logs for the pod (for target summary)
  const [podAgents, setPodAgents] = useState<AppUser[]>([]); // Agents in the user's pod
  const [teams, setTeams] = useState<any[]>([]);
  const [dailyTargets, setDailyTargets] = useState<DailyTargetData | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true); // Combined loading state for scores/leaderboard

  // 1. Get current user and their pod ID (using onSnapshot for real-time updates)
  useEffect(() => {
    setIsLoadingUser(true);
    console.log("[AgentDashboard] Setting up auth listener...");
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      let unsubscribeUserDoc: Unsubscribe = () => {};
      if (user) {
        console.log(`[AgentDashboard] Auth state changed: User found (UID: ${user.uid})`);
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = { id: docSnap.id, ...docSnap.data() } as AppUser;
            console.log("[AgentDashboard] User document snapshot received:", userData);
            setCurrentUser(userData);
            const newPodId = userData.podId || null;
            // Only update podId state if it actually changes
            if (newPodId !== agentPodId) {
                 setAgentPodId(newPodId);
                 console.log("[AgentDashboard] Agent Pod ID set to:", newPodId);
                 if (!newPodId) {
                     console.warn("[AgentDashboard] User is not assigned to a pod.");
                     setError("You are not currently assigned to a pod. Some features may be unavailable.");
                 } else {
                     setError(prevError => (prevError === "You are not currently assigned to a pod. Some features may be unavailable." ? null : prevError));
                 }
            }
          } else {
             console.error(`[AgentDashboard] User document not found in Firestore for UID: ${user.uid}`);
             setError("Could not find your user profile.");
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
      return () => {
        console.log("[AgentDashboard] Cleaning up user doc listener.");
        if (unsubscribeUserDoc) {
          unsubscribeUserDoc();
        }
      };
    });
    return () => {
         console.log("[AgentDashboard] Cleaning up auth listener.");
        unsubscribeAuth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Removed agentPodId from dependency array to prevent loop


  // 2. Fetch Agent's KPIs (Runs when podId or user loading state changes)
   useEffect(() => {
     console.log(`[AgentDashboard] KPI Effect triggered: isLoadingUser=${isLoadingUser}, agentPodId=${agentPodId}`);
     // Wait for user and podId to be loaded and valid
     if (isLoadingUser || !agentPodId) {
         console.log("[AgentDashboard] KPI Effect: Skipping KPI fetch, prerequisites not met.");
          // Only set loading false if user loading is complete
         if(!isLoadingUser) setKpisLoading(false);
         // Clear KPIs if prerequisites are no longer met
         if(kpis.length > 0) setKpis([]);
         return;
     };

     setKpisLoading(true);
     console.log("[AgentDashboard] KPI Effect: Fetching KPIs for pod:", agentPodId);
     const fetchAgentKpis = async () => {
       try {
         const agentGroup: Group = { id: agentPodId, name: 'Your Pod' };
         console.log("[AgentDashboard] KPI Effect: Calling getKPIs with group:", agentGroup);
         const fetchedKpis = await getKPIs(agentGroup);
         console.log(`[AgentDashboard] KPI Effect: Fetched ${fetchedKpis.length} KPIs:`, fetchedKpis);
         setKpis(fetchedKpis);

         // Only clear KPI specific errors on success
         setError(prevError =>
             prevError === "No KPIs found for your pod." || prevError === "Failed to load your KPIs."
             ? null
             : prevError
         );

         if (fetchedKpis.length === 0) {
             console.warn("[AgentDashboard] KPI Effect: No KPIs returned for pod ID:", agentPodId);
             // Set specific error only if no other critical error exists
             setError(prevError => prevError ? prevError : "No KPIs found for your pod.");
         }

       } catch (kpiError) {
         console.error("[AgentDashboard] Error fetching agent KPIs:", kpiError);
         setError("Failed to load your KPIs.");
          setKpis([]); // Clear KPIs on error
       } finally {
         setKpisLoading(false);
         console.log("[AgentDashboard] KPI Effect: KPI loading finished.");
       }
     };
     fetchAgentKpis();
   }, [agentPodId, isLoadingUser]); // Rerun only if podId or user loading state changes


   // 3. Fetch Competition Rules, Listen to Logs, Targets, Pod Agents, and Teams
  useEffect(() => {
    console.log(`[AgentDashboard] Data Effect triggered: isLoadingUser=${isLoadingUser}, agentPodId=${agentPodId}, currentUser=${!!currentUser}`);
    // Ensure user, podId are available and user loading is complete
    if (!agentPodId || !currentUser?.id || isLoadingUser) {
      console.log("[AgentDashboard] Data Effect: Skipping data fetch, prerequisites not met.");
      // Stop loading if prerequisites aren't met *after* initial user load is done
      if(!isLoadingUser) setIsLoadingData(false);
      // Clear dependent state if prerequisites are missing after initial load
      if(!isLoadingUser) {
          console.log("[AgentDashboard] Data Effect: Clearing dependent state (rules, logs, etc.)");
          setRules([]);
          setDailyLogs([]);
          setPodLogs([]);
          setDailyTargets(null);
          setPodAgents([]);
          setTeams([]);
      }
      return () => {}; // Return empty cleanup
    }

    console.log("[AgentDashboard] Data Effect: Starting data fetch and listeners for pod:", agentPodId);
    setIsLoadingData(true); // Start loading data

    let unsubscribeUserLogs: Unsubscribe = () => {};
    let unsubscribePodLogs: Unsubscribe = () => {};
    let unsubscribeTargets: Unsubscribe = () => {};
    let unsubscribeAgents: Unsubscribe = () => {};
    let unsubscribeCompetition: Unsubscribe | null = null; // Competition listener

    let currentActiveCompetition: CompetitionWithRules | null = null; // Track competition for filtering

    const fetchAndListen = async () => {
        // Fetch Agents in the pod (listen for changes)
       console.log("[AgentDashboard] Data Effect: Setting up agents listener for pod:", agentPodId);
       const usersRef = collection(db, 'users');
       const agentsQuery = query(usersRef, where('podId', '==', agentPodId), where('roles', 'array-contains', 'agent'), orderBy('name'));
       unsubscribeAgents = onSnapshot(agentsQuery, (agentsSnapshot) => {
            const fetchedAgents = agentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
            console.log("[AgentDashboard] Data Effect: Pod agents listener updated, found:", fetchedAgents.length);
            setPodAgents(fetchedAgents);
        }, (err) => {
             console.error("[AgentDashboard] Error listening to pod agents:", err);
             setError("Failed to load pod member data.");
             setIsLoadingData(false); // Stop loading on agent fetch error
        });


      // Find Active Competition based on *today's date* and listen for changes
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
           let activeCompetition: CompetitionWithRules | null = null;
           for (const docSnap of competitionSnapshot.docs) {
               const comp = { id: docSnap.id, ...docSnap.data() } as CompetitionWithRules & { id: string };
                if (comp.endDate && comp.endDate instanceof Timestamp && comp.endDate.toDate() >= todayTimestamp) {
                   activeCompetition = comp;
                   console.log("[AgentDashboard] Data Effect: Found active competition:", activeCompetition.id, activeCompetition.name);
                   break;
                } else {
                   console.log(`[AgentDashboard] Data Effect: Competition ${comp.id} ignored (endDate ${comp.endDate?.toDate().toISOString()} < today ${todayTimestamp.toDate().toISOString()})`);
                }
           }

           currentActiveCompetition = activeCompetition;

           if (unsubscribeUserLogs) { console.log("[AgentDashboard] Data Effect: Cleaning up old user logs listener"); unsubscribeUserLogs(); }
           if (unsubscribePodLogs) { console.log("[AgentDashboard] Data Effect: Cleaning up old pod logs listener"); unsubscribePodLogs(); }
           if (unsubscribeTargets) { console.log("[AgentDashboard] Data Effect: Cleaning up old targets listener"); unsubscribeTargets(); }


           if (activeCompetition) {
               console.log("[AgentDashboard] Data Effect: Active competition confirmed:", activeCompetition.id, "Rules:", activeCompetition.rules?.length || 0, "Teams:", activeCompetition.teams?.length || 0);
               setRules(activeCompetition.rules || []);
               setTeams(activeCompetition.teams || []);

               const achievementsRef = collection(db, 'dailyAchievements');

               console.log("[AgentDashboard] Data Effect: Setting up new user logs listener for competition:", activeCompetition.id);
               const userLogsQuery = query(
                   achievementsRef,
                   where('agentId', '==', currentUser.id),
                   where('podId', '==', agentPodId),
                   where('competitionId', '==', activeCompetition.id)
               );
               unsubscribeUserLogs = onSnapshot(userLogsQuery, (snapshot) => {
                   const fetchedLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
                   setDailyLogs(fetchedLogs);
                   console.log(`[AgentDashboard] Data Effect: User logs listener updated, found ${fetchedLogs.length} total logs for user in competition.`);
               }, (err) => {
                    console.error("[AgentDashboard] Error listening to user logs:", err);
                    setError("Failed to load your scores.");
                });


                console.log("[AgentDashboard] Data Effect: Setting up new pod logs listener for competition:", activeCompetition.id);
                const podLogsQuery = query(
                   achievementsRef,
                   where('podId', '==', agentPodId),
                   where('competitionId', '==', activeCompetition.id)
               );
               unsubscribePodLogs = onSnapshot(podLogsQuery, (snapshot) => {
                   const fetchedLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
                   setPodLogs(fetchedLogs);
                   console.log(`[AgentDashboard] Data Effect: Pod logs listener updated, found ${fetchedLogs.length} total logs for pod in competition.`);
               }, (err) => {
                    console.error("[AgentDashboard] Error listening to pod logs:", err);
                    setError("Failed to load pod scores.");
                });


               const targetsDocId = `${activeCompetition.id}_${agentPodId}`;
               console.log("[AgentDashboard] Data Effect: Setting up new targets listener for doc:", targetsDocId);
               const targetsDocRef = doc(db, 'dailyPodTargets', targetsDocId);
               unsubscribeTargets = onSnapshot(targetsDocRef, (docSnap) => {
                   const targetData = docSnap.exists() ? docSnap.data() as DailyTargetData : null;
                   setDailyTargets(targetData);
                   console.log("[AgentDashboard] Data Effect: Targets listener updated, target doc exists:", docSnap.exists(), "Data:", targetData);
               }, (err) => {
                    console.error("[AgentDashboard] Error listening to daily targets:", err);
                    setError("Failed to load targets.");
                });

               setError(prevError => (
                   ["Failed to load competition data.", "Failed to load your scores.", "Failed to load pod scores.", "Failed to load targets."].includes(prevError || "")
                   ? null
                   : prevError
                ));


           } else {
               console.log("[AgentDashboard] Data Effect: No active competition found.");
               setRules([]);
               setTeams([]);
               setDailyLogs([]);
               setPodLogs([]);
               setDailyTargets(null);

                if (unsubscribeUserLogs) { console.log("[AgentDashboard] Data Effect: Cleaning up user logs listener (no active comp)"); unsubscribeUserLogs(); }
                if (unsubscribePodLogs) { console.log("[AgentDashboard] Data Effect: Cleaning up pod logs listener (no active comp)"); unsubscribePodLogs(); }
                if (unsubscribeTargets) { console.log("[AgentDashboard] Data Effect: Cleaning up targets listener (no active comp)"); unsubscribeTargets(); }

                // Set specific error only if no critical user error exists
                setError(prevError =>
                    prevError === "You are not currently assigned to a pod." || prevError === "Could not find your user profile." || prevError === "You must be logged in." || prevError === "Failed to load your profile information."
                    ? prevError
                    : "No active competition found for your pod today."
                );

           }
            setIsLoadingData(false);
            console.log("[AgentDashboard] Data Effect: Data loading state set to false.");

       }, (err) => {
           console.error("[AgentDashboard] Error listening to competitions:", err);
           setError("Failed to load competition data.");
           setIsLoadingData(false);
           if (unsubscribeUserLogs) unsubscribeUserLogs();
           if (unsubscribePodLogs) unsubscribePodLogs();
           if (unsubscribeTargets) unsubscribeTargets();
           if (unsubscribeAgents) unsubscribeAgents();
       });
    };

    fetchAndListen();

    return () => {
      console.log("[AgentDashboard] Data Effect: Cleaning up ALL listeners.");
      unsubscribeUserLogs();
      unsubscribePodLogs();
      unsubscribeTargets();
      unsubscribeAgents();
      if (unsubscribeCompetition) unsubscribeCompetition();
    };
  }, [agentPodId, currentUser?.id, isLoadingUser]); // Dependency array ensures this runs when needed


  // 4. Process data (Scores, Leaderboards) - useMemo
  const { agentScore, podTargetSummary, agentLeaderboard, teamLeaderboard } = useMemo(() => {
     console.log(`[AgentDashboard] Memo triggered: Calculating scores/leaderboards. Daily Logs: ${dailyLogs.length}, Pod Logs: ${podLogs.length}, Agents: ${podAgents.length}, Teams: ${teams.length}`);
    // --- Calculate Agent's Score for Today ---
    let currentAgentScore: Omit<AgentScore, 'agentId' | 'agentFirstName'> = { totalPoints: 0, emojiString: '' };
    if (currentUser && rules.length > 0) {
        const todayTimestamp = startOfDay(new Date());
        const todayLogs = dailyLogs.filter(log => log.date && log.date.toDate && log.date.toDate() >= todayTimestamp);
        console.log(`[AgentDashboard] Memo: Found ${todayLogs.length} logs for current agent today.`);
        let agentEmojis = '';
        const sortedRules = [...rules].sort((a, b) => a.name.localeCompare(b.name));

        sortedRules.forEach(rule => {
            if (!rule.id) return;
            const logForRule = todayLogs.find(log => log.ruleId === rule.id);
            if (logForRule) {
                 // Check if points is a valid number, default to 0 if not
                const pointsToAdd = typeof logForRule.points === 'number' && !isNaN(logForRule.points) ? logForRule.points : 0;
                currentAgentScore.totalPoints += pointsToAdd;
                if (logForRule.value > 0) {
                    const emojiToUse = rule.emoji && rule.emoji.trim() !== '' ? rule.emoji : '❓';
                    for (let i = 0; i < logForRule.value; i++) {
                        agentEmojis += emojiToUse;
                    }
                }
            }
        });
        currentAgentScore.emojiString = agentEmojis;
    }
     const finalAgentScore : AgentScore | null = currentUser ? {
         agentId: currentUser.id!,
         agentFirstName: currentUser.name.split(' ')[0] || currentUser.name,
         ...currentAgentScore
    } : null;
     console.log("[AgentDashboard] Memo: Calculated agent score for today:", finalAgentScore);

    // --- Calculate Pod Target Summary for Today ---
    const dayOfWeek = daysOfWeek[getDay(new Date())];
    const ruleTotals: Record<string, number> = {};
    rules.forEach(rule => { if (rule.id) ruleTotals[rule.id] = 0; });
    const todayPodLogs = podLogs.filter(log => log.date && log.date.toDate && log.date.toDate() >= startOfDay(new Date()));
    console.log(`[AgentDashboard] Memo: Found ${todayPodLogs.length} logs for pod today.`);
    todayPodLogs.forEach(log => { if (ruleTotals.hasOwnProperty(log.ruleId)) ruleTotals[log.ruleId] += log.value || 0; }); // Ensure value is number

    const finalPodTargetSummary: PodTargetSummary[] = rules
        .map(rule => {
            if (!rule.id) return null;
            const targetValue = dailyTargets?.[rule.id]?.[dayOfWeek];
             console.log(`[AgentDashboard] Memo: Target for Rule ${rule.name} (${rule.id}) on ${dayOfWeek}: ${targetValue}`);
            if (targetValue === undefined || targetValue === null) return null;
            const emojiToUse = rule.emoji && rule.emoji.trim() !== '' ? rule.emoji : '❓';
            return { ruleId: rule.id, ruleName: rule.name, ruleEmoji: emojiToUse, achieved: ruleTotals[rule.id] || 0, target: targetValue };
        })
        .filter((item): item is PodTargetSummary => item !== null)
        .sort((a, b) => a.ruleName.localeCompare(b.ruleName));
     console.log("[AgentDashboard] Memo: Calculated pod target summary for today:", finalPodTargetSummary);


     // --- Calculate Leaderboards (using all fetched podLogs for the competition duration) ---
     // Agent Leaderboard
     const agentScoresMap: Record<string, number> = {};
     podAgents.forEach(agent => { if(agent.id) agentScoresMap[agent.id] = 0; });
     podLogs.forEach(log => {
        if (agentScoresMap.hasOwnProperty(log.agentId)) {
            // Check if points is a valid number, default to 0 if not
            const pointsToAdd = typeof log.points === 'number' && !isNaN(log.points) ? log.points : 0;
            agentScoresMap[log.agentId] += pointsToAdd;
             if (isNaN(pointsToAdd)) {
                 console.warn(`[AgentDashboard] Log ID ${log.id} for agent ${log.agentId} has invalid points value: ${log.points}`);
             }
        }
     });
     const finalAgentLeaderboard: LeaderboardEntry[] = podAgents
       .map(agent => ({
         id: agent.id!,
         name: agent.name,
         totalPoints: agentScoresMap[agent.id!] || 0,
         score: agentScoresMap[agent.id!] || 0, // Explicitly add score
         avatarUrl: agent.avatarUrl,
         avatarInitials: agent.avatarInitials,
         avatarBgColor: agent.avatarBgColor,
         isCurrentUser: agent.id === currentUser?.id
       }))
       .sort((a, b) => b.totalPoints - a.totalPoints)
       .map((entry, index) => ({ ...entry, rank: index + 1 }));
     console.log(`[AgentDashboard] Memo: Calculated agent leaderboard (${finalAgentLeaderboard.length} entries):`, finalAgentLeaderboard);


     // Team Leaderboard
     const teamScoresMap: Record<string, number> = {};
     teams.forEach(team => { teamScoresMap[team.id] = 0; });
     podLogs.forEach(log => {
        const agentTeam = teams.find(team => team.agentIds?.includes(log.agentId));
        if (agentTeam && teamScoresMap.hasOwnProperty(agentTeam.id)) {
             // Check if points is a valid number, default to 0 if not
            const pointsToAdd = typeof log.points === 'number' && !isNaN(log.points) ? log.points : 0;
            teamScoresMap[agentTeam.id] += pointsToAdd;
             if (isNaN(pointsToAdd)) {
                 console.warn(`[AgentDashboard] Log ID ${log.id} for agent ${log.agentId} (in team ${agentTeam.id}) has invalid points value: ${log.points}`);
             }
        }
     });
     const finalTeamLeaderboard: LeaderboardEntry[] = teams
       .map(team => ({
         id: team.id,
         name: team.name,
         totalPoints: teamScoresMap[team.id] || 0,
         score: teamScoresMap[team.id] || 0, // Explicitly add score
         isCurrentUserTeam: team.agentIds?.includes(currentUser?.id || '')
       }))
       .sort((a, b) => b.totalPoints - a.totalPoints)
       .map((entry, index) => ({ ...entry, rank: index + 1 }));
     console.log(`[AgentDashboard] Memo: Calculated team leaderboard (${finalTeamLeaderboard.length} entries):`, finalTeamLeaderboard);


    return { agentScore: finalAgentScore, podTargetSummary: finalPodTargetSummary, agentLeaderboard: finalAgentLeaderboard, teamLeaderboard: finalTeamLeaderboard };
  }, [dailyLogs, podLogs, rules, dailyTargets, currentUser, podAgents, teams]);

  const isLoading = isLoadingUser || isLoadingData || kpisLoading; // Combined loading state

  return (
    <>
      {error && error !== "No active competition found for your pod today." && ( // Don't show the 'no competition' error as a destructive alert
         <Alert variant="destructive" className="mb-6">
           <AlertCircle className="h-4 w-4" />
           <UIDescription>{error}</UIDescription>
         </Alert>
      )}

      {/* KPI Cards Section */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
        {isLoadingUser || kpisLoading ? ( // Show skeleton if loading user or KPIs
           Array.from({ length: 3 }).map((_, index) => (
             <Card key={`kpi-skeleton-${index}`} className="shadow-md">
               <CardHeader className="pb-2"> <Skeleton className="h-4 w-1/2 rounded" /> </CardHeader>
               <CardContent>
                 <Skeleton className="h-8 w-1/2 rounded mb-2" />
                 <Skeleton className="h-3 w-1/3 rounded mb-3" />
                 <Skeleton className="h-2 w-full rounded mb-1" />
                 <Skeleton className="h-3 w-1/4 rounded" />
               </CardContent>
             </Card>
           ))
        ) : kpis.length > 0 ? (
          kpis.map((kpi, index) => (
            <KpiCard key={kpi.name || index} kpi={kpi} icon={kpiIcons[kpi.name]} />
          ))
        ) : !error && !isLoadingUser && agentPodId ? ( // Show only if not loading, no error, and has podId
             <Card className="md:col-span-full lg:col-span-full shadow-md">
                 <CardContent className="pt-6 text-center text-muted-foreground">No KPIs currently configured for your pod.</CardContent>
            </Card>
        ) : null }
      </div>

      {/* Daily Score and Pod Target Summary Section */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 mb-6">
          {/* Daily Score Card */}
           <Card className="shadow-md">
             <CardHeader>
               <CardTitle className="flex items-center gap-2"> <ClipboardList className="h-5 w-5"/> Your Score Today ({format(new Date(), 'PPP')})</CardTitle>
             </CardHeader>
             <CardContent>
                {isLoading ? ( // Combined loading state
                    <div className="space-y-3">
                         <Skeleton className="h-4 w-3/4 rounded" />
                         <Skeleton className="h-8 w-1/4 rounded" />
                         <Skeleton className="h-6 w-full rounded" />
                    </div>
                ) : agentScore ? (
                    <>
                        <div className="text-3xl font-bold text-primary mb-2">{agentScore.totalPoints} pts</div>
                        <div className="flex flex-wrap gap-1">
                            {Array.from(agentScore.emojiString).map((emoji, index) => (
                                <span key={`${agentScore.agentId}-emoji-${index}`} className="text-2xl" title={rules.find(r => r.emoji === emoji)?.name}>
                                    {emoji}
                                </span>
                            ))}
                            {agentScore.emojiString.length === 0 && <span className="text-base text-muted-foreground">- No achievements logged today -</span>}
                        </div>
                     </>
                 ) : !error ? (
                     <p className="text-muted-foreground">Could not load your score.</p>
                 ) : null}
             </CardContent>
           </Card>

           {/* Pod Target Summary Card */}
           <Card className="shadow-md">
              <CardHeader>
                   <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5"/> Pod Targets Today</CardTitle>
              </CardHeader>
              <CardContent>
                   {isLoading ? ( // Combined loading state
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
                                       {summary.achieved}
                                       {summary.target !== null ? ` / ${summary.target}` : ''}
                                   </span>
                               </div>
                           ))}
                       </div>
                   ) : !error && !isLoading ? ( // Only show 'no targets' if not loading and no other error
                       <p className="text-muted-foreground">No targets set for your pod today.</p>
                   ) : null }
               </CardContent>
            </Card>
      </div>


      {/* Leaderboards Section */}
      <div className="grid gap-6 md:grid-cols-2">
          {isLoading ? ( // Combined loading state
               <>
                  <Skeleton className="h-[400px] w-full" />
                  <Skeleton className="h-[400px] w-full" />
               </>
           ) : (
               <>
                  {teamLeaderboard.length > 0 ? (
                      <Leaderboard title="Team Leaderboard" entries={teamLeaderboard} description="Current Competition Ranking" />
                  ) : !error && !isLoading && rules.length > 0 ? ( // Show only if rules exist (implies active comp) but no team data
                     <Card className="h-[400px] flex items-center justify-center shadow-md"><CardContent className="text-muted-foreground text-center">No team data available for the current competition.</CardContent></Card>
                  ) : null}
                   {agentLeaderboard.length > 0 ? (
                       <Leaderboard title="Agent Leaderboard" entries={agentLeaderboard} description="Current Competition Ranking" />
                   ) : !error && !isLoading && rules.length > 0 ? ( // Show only if rules exist but no agent data
                     <Card className="h-[400px] flex items-center justify-center shadow-md"><CardContent className="text-muted-foreground text-center">No agent data available for the current competition.</CardContent></Card>
                   ) : null}
                   {/* Show message if no active competition was found */}
                    {error === "No active competition found for your pod today." && (
                         <Card className="md:col-span-2 h-[100px] flex items-center justify-center shadow-md"><CardContent className="text-muted-foreground text-center">No competition is currently active for your pod.</CardContent></Card>
                    )}
               </>
           )}
      </div>
    </>
  );
}
