
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { KpiCard } from '@/components/kpi-card';
import { Leaderboard } from '@/components/leaderboard';
import { getKPIs, KPI, Group } from '@/services/kpi'; // Keep KPI fetching
import { DollarSign, Target, Users, Medal, Trophy, ClipboardList, AlertCircle } from 'lucide-react'; // Add required icons
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { collection, query, where, getDocs, Timestamp, doc, getDoc, orderBy, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { DailyAchievementLog } from '@/app/(admin)/admin/log-achievements/page'; // Assuming DailyAchievementLog interface is here
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog';
import type { DailyTargetData } from '@/app/(admin)/admin/pod-targets/page';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import { Badge } from '@/components/ui/badge'; // Import Badge
import { useToast } from '@/hooks/use-toast'; // Import useToast

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
        case 1: return { backgroundColor: '#9f8f5e', color: '#ffffff' };
        case 2: return { backgroundColor: '#969696', color: '#ffffff' };
        case 3: return { backgroundColor: '#996b4f', color: '#ffffff' };
        default: return {};
    }
};

// Mock group ID for KPIs (adjust if needed)
const AGENT_GROUP_ID = 'pod-bravo-123'; // TODO: Replace with dynamic pod ID

const kpiIcons: { [key: string]: React.ReactNode } = {
  'Sales': <DollarSign className="h-4 w-4" />,
  'Customer Acquisition': <Target className="h-4 w-4" />,
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
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      let unsubscribeUserDoc: Unsubscribe = () => {};
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = { id: docSnap.id, ...docSnap.data() } as AppUser;
            setCurrentUser(userData);
            setAgentPodId(userData.podId || null);
            if (!userData.podId) {
              setError("You are not currently assigned to a pod.");
            } else {
              setError(null); // Clear error if pod is assigned
            }
          } else {
             setError("Could not find your user profile.");
             setCurrentUser(null);
             setAgentPodId(null);
          }
          setIsLoadingUser(false);
        }, (err) => {
           console.error("Error listening to user document:", err);
           setError("Failed to load your profile information.");
           setCurrentUser(null);
           setAgentPodId(null);
           setIsLoadingUser(false);
        });
      } else {
         setError("You must be logged in.");
         setCurrentUser(null);
         setAgentPodId(null);
         setIsLoadingUser(false);
      }
      return () => {
        if (unsubscribeUserDoc) {
          unsubscribeUserDoc();
        }
      };
    });
    return () => unsubscribeAuth();
  }, []);

  // 2. Fetch Agent's KPIs (Only runs once or when pod changes if dynamic)
   useEffect(() => {
     // Wait for user and podId to be loaded
     if (isLoadingUser || !agentPodId) {
         setKpisLoading(!isLoadingUser); // Stop KPI loading if user load is done but no pod
         return;
     };

     setKpisLoading(true);
     const fetchAgentKpis = async () => {
       try {
         // Use the dynamically fetched agentPodId
         const agentGroup: Group = { id: agentPodId, name: 'Your Pod' }; // Consider fetching pod name if needed
         const fetchedKpis = await getKPIs(agentGroup);
         setKpis(fetchedKpis);
          setError(null); // Clear KPI specific error on success
       } catch (error) {
         console.error("Error fetching agent KPIs:", error);
         setError("Failed to load your KPIs."); // Set specific KPI error
       } finally {
         setKpisLoading(false);
       }
     };
     fetchAgentKpis();
   }, [agentPodId, isLoadingUser]); // Rerun if podId or user loading state changes


   // 3. Fetch Competition Rules, Listen to Logs, Targets, Pod Agents, and Teams
  useEffect(() => {
    // Ensure user, podId are available and user loading is complete
    if (!agentPodId || !currentUser?.id || isLoadingUser) {
      setIsLoadingData(false); // Stop loading if prerequisites aren't met
      // Clear dependent state
      setRules([]);
      setDailyLogs([]);
      setPodLogs([]);
      setDailyTargets(null);
      setPodAgents([]);
      setTeams([]);
      return () => {}; // Return empty cleanup
    }

    setIsLoadingData(true); // Start loading data
    // Clear previous non-user error
    if(error !== "You are not currently assigned to a pod." && error !== "Could not find your user profile." && error !== "You must be logged in." && error !== "Failed to load your profile information."){
         setError(null);
    }


    let unsubscribeUserLogs: Unsubscribe = () => {};
    let unsubscribePodLogs: Unsubscribe = () => {};
    let unsubscribeTargets: Unsubscribe = () => {};
    let unsubscribeAgents: Unsubscribe = () => {};
    let unsubscribeCompetition: Unsubscribe | null = null; // Competition listener

    const fetchAndListen = async () => {
      try {
          // Fetch Agents in the pod (listen for changes)
         const usersRef = collection(db, 'users');
         const agentsQuery = query(usersRef, where('podId', '==', agentPodId), where('roles', 'array-contains', 'agent'), orderBy('name'));
         unsubscribeAgents = onSnapshot(agentsQuery, (agentsSnapshot) => {
              setPodAgents(agentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)));
          }, (err) => {
               console.error("Error listening to pod agents:", err);
               setError("Failed to load pod member data.");
               setIsLoadingData(false); // Stop loading on agent fetch error
          });


        // Find Active Competition based on *today's date* and listen for changes
        const competitionsRef = collection(db, 'competitions');
        const todayTimestamp = Timestamp.fromDate(startOfDay(new Date()));

        const competitionQuery = query(
          competitionsRef,
          where('podIds', 'array-contains', agentPodId),
          where('startDate', '<=', todayTimestamp),
          orderBy('startDate', 'desc')
          // We'll filter endDate client-side as Firestore can't range filter on two fields
        );

         // Listen to the competition query
         unsubscribeCompetition = onSnapshot(competitionQuery, (competitionSnapshot) => {
             let activeCompetition: CompetitionWithRules | null = null;
             for (const docSnap of competitionSnapshot.docs) {
                 const comp = { id: docSnap.id, ...docSnap.data() } as CompetitionWithRules & { id: string };
                 if (comp.endDate && comp.endDate instanceof Timestamp && comp.endDate.toDate() >= todayTimestamp) {
                     activeCompetition = comp;
                     break;
                 }
             }

             if (activeCompetition) {
                 setRules(activeCompetition.rules || []);
                 setTeams(activeCompetition.teams || []); // Update teams from competition data

                 // --- Set up listeners for logs and targets based on this active competition ---
                 const achievementsRef = collection(db, 'dailyAchievements');

                 // --- User Logs Listener ---
                 const userLogsQuery = query(
                     achievementsRef,
                     where('agentId', '==', currentUser.id),
                     where('podId', '==', agentPodId),
                     where('date', '>=', activeCompetition.startDate), // Filter by competition start
                     where('date', '<=', activeCompetition.endDate), // Filter by competition end
                     where('competitionId', '==', activeCompetition.id)
                 );
                 // Ensure previous listener is cleaned up before creating a new one
                 if (unsubscribeUserLogs) unsubscribeUserLogs();
                 unsubscribeUserLogs = onSnapshot(userLogsQuery, (snapshot) => {
                     setDailyLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog)));
                 }, (err) => { console.error("Error listening to user logs:", err); setError("Failed to load your scores."); });


                 // --- Pod Logs Listener ---
                 const podLogsQuery = query(
                     achievementsRef,
                     where('podId', '==', agentPodId),
                     where('date', '>=', activeCompetition.startDate), // Filter by competition start
                     where('date', '<=', activeCompetition.endDate), // Filter by competition end
                     where('competitionId', '==', activeCompetition.id)
                 );
                  // Ensure previous listener is cleaned up
                 if (unsubscribePodLogs) unsubscribePodLogs();
                 unsubscribePodLogs = onSnapshot(podLogsQuery, (snapshot) => {
                     setPodLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog)));
                 }, (err) => { console.error("Error listening to pod logs:", err); setError("Failed to load pod scores."); });


                 // --- Targets Listener ---
                 const targetsDocId = `${activeCompetition.id}_${agentPodId}`;
                 const targetsDocRef = doc(db, 'dailyPodTargets', targetsDocId);
                  // Ensure previous listener is cleaned up
                 if (unsubscribeTargets) unsubscribeTargets();
                 unsubscribeTargets = onSnapshot(targetsDocRef, (docSnap) => {
                     setDailyTargets(docSnap.exists() ? docSnap.data() as DailyTargetData : null);
                 }, (err) => { console.error("Error listening to daily targets:", err); setError("Failed to load targets."); });

             } else {
                 // No active competition found for today
                 setRules([]);
                 setTeams([]);
                 setDailyLogs([]);
                 setPodLogs([]);
                 setDailyTargets(null);
                  toast({ variant: "default", title: "No Active Competition", description: "No competition running for your pod today." });
             }
              // Consider loading complete after the initial snapshot of the competition query
              setIsLoadingData(false);
               // Clear non-user errors if data loads successfully
              if(error !== "You are not currently assigned to a pod." && error !== "Could not find your user profile." && error !== "You must be logged in." && error !== "Failed to load your profile information."){
                   setError(null);
              }
         }, (err) => {
             console.error("Error listening to competitions:", err);
             setError("Failed to load competition data.");
             setIsLoadingData(false);
         });


      } catch (err) { // Catch synchronous errors in setup
        console.error("Error setting up listeners:", err);
        setError("Failed to initialize dashboard data.");
        setIsLoadingData(false);
      }
    };

    fetchAndListen();

    // Cleanup function for ALL listeners
    return () => {
      unsubscribeUserLogs();
      unsubscribePodLogs();
      unsubscribeTargets();
      unsubscribeAgents();
      if (unsubscribeCompetition) unsubscribeCompetition(); // Unsubscribe from competition listener
    };
  }, [agentPodId, currentUser?.id, isLoadingUser, error, toast]); // Dependencies


  // 4. Process data (Scores, Leaderboards) - useMemo
  const { agentScore, podTargetSummary, agentLeaderboard, teamLeaderboard } = useMemo(() => {
    // --- Calculate Agent's Score for Today ---
    let currentAgentScore: Omit<AgentScore, 'agentId' | 'agentFirstName'> = { totalPoints: 0, emojiString: '' };
    if (currentUser) {
        const todayTimestamp = startOfDay(new Date());
        const todayLogs = dailyLogs.filter(log => log.date.toDate() >= todayTimestamp); // Filter for today only
        let agentEmojis = '';
        const sortedRules = [...rules].sort((a, b) => a.name.localeCompare(b.name));

        sortedRules.forEach(rule => {
            if (!rule.id) return;
            const logForRule = todayLogs.find(log => log.ruleId === rule.id);
            if (logForRule) {
                currentAgentScore.totalPoints += logForRule.points;
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

    // --- Calculate Pod Target Summary for Today ---
    const dayOfWeek = daysOfWeek[getDay(new Date())];
    const ruleTotals: Record<string, number> = {};
    rules.forEach(rule => { if (rule.id) ruleTotals[rule.id] = 0; });
    const todayPodLogs = podLogs.filter(log => log.date.toDate() >= startOfDay(new Date())); // Filter for today
    todayPodLogs.forEach(log => { if (ruleTotals.hasOwnProperty(log.ruleId)) ruleTotals[log.ruleId] += log.value; });

    const finalPodTargetSummary: PodTargetSummary[] = rules
        .map(rule => {
            if (!rule.id) return null;
            const targetValue = dailyTargets?.[rule.id]?.[dayOfWeek];
            if (targetValue === undefined || targetValue === null) return null;
            const emojiToUse = rule.emoji && rule.emoji.trim() !== '' ? rule.emoji : '❓';
            return { ruleId: rule.id, ruleName: rule.name, ruleEmoji: emojiToUse, achieved: ruleTotals[rule.id] || 0, target: targetValue };
        })
        .filter((item): item is PodTargetSummary => item !== null)
        .sort((a, b) => a.ruleName.localeCompare(b.ruleName));

     // --- Calculate Leaderboards (using all fetched podLogs for the competition duration) ---
     // Agent Leaderboard
     const agentScoresMap: Record<string, number> = {};
     podAgents.forEach(agent => { agentScoresMap[agent.id!] = 0; });
     podLogs.forEach(log => { if (agentScoresMap.hasOwnProperty(log.agentId)) agentScoresMap[log.agentId] += log.points; });
     const finalAgentLeaderboard: LeaderboardEntry[] = podAgents
       .map(agent => ({ id: agent.id!, name: agent.name, totalPoints: agentScoresMap[agent.id!] || 0, avatarUrl: agent.avatarUrl, avatarInitials: agent.avatarInitials, avatarBgColor: agent.avatarBgColor, isCurrentUser: agent.id === currentUser?.id }))
       .sort((a, b) => b.totalPoints - a.totalPoints)
       .map((entry, index) => ({ ...entry, rank: index + 1 }));

     // Team Leaderboard
     const teamScoresMap: Record<string, number> = {};
     teams.forEach(team => { teamScoresMap[team.id] = 0; });
     podLogs.forEach(log => { const agentTeam = teams.find(team => team.agentIds?.includes(log.agentId)); if (agentTeam && teamScoresMap.hasOwnProperty(agentTeam.id)) teamScoresMap[agentTeam.id] += log.points; });
     const finalTeamLeaderboard: LeaderboardEntry[] = teams
       .map(team => ({ id: team.id, name: team.name, totalPoints: teamScoresMap[team.id] || 0, isCurrentUserTeam: team.agentIds?.includes(currentUser?.id || '') }))
       .sort((a, b) => b.totalPoints - a.totalPoints)
       .map((entry, index) => ({ ...entry, rank: index + 1 }));


    return { agentScore: finalAgentScore, podTargetSummary: finalPodTargetSummary, agentLeaderboard: finalAgentLeaderboard, teamLeaderboard: finalTeamLeaderboard };
  }, [dailyLogs, podLogs, rules, dailyTargets, currentUser, podAgents, teams]); // Dependencies updated

  const isLoading = isLoadingUser || isLoadingData; // Combined loading state

  return (
    <>
      {error && (
         <Alert variant="destructive" className="mb-6">
           <AlertCircle className="h-4 w-4" />
           <CardDescription>{error}</CardDescription> {/* Using CardDescription for consistency */}
         </Alert>
      )}

      {/* KPI Cards Section */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
        {kpisLoading ? (
           Array.from({ length: 3 }).map((_, index) => (
             <Card key={index} className="shadow-md">
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
        ) : !kpisLoading && !error ? ( // Only show if not loading and no other error
            <Card className="md:col-span-2 lg:col-span-3 shadow-md">
                 <CardContent className="pt-6 text-center text-muted-foreground">No KPIs found for your pod.</CardContent>
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
                {isLoading ? (
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
                 ) : !error ? ( // Only show if not loading and no other error
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
                                       {summary.achieved}
                                       {summary.target !== null ? ` / ${summary.target}` : ''}
                                   </span>
                               </div>
                           ))}
                       </div>
                   ) : !error ? ( // Only show if not loading and no other error
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
                  <Leaderboard title="Team Leaderboard" entries={teamLeaderboard} description="Current Competition Ranking" />
                  <Leaderboard title="Agent Leaderboard" entries={agentLeaderboard} description="Current Competition Ranking" />
               </>
           )}
      </div>
    </>
  );
}
