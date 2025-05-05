'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  doc,
  getDoc,
  orderBy,
  onSnapshot, // Use onSnapshot
  Unsubscribe, // Use Unsubscribe
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { CalendarIcon, Loader2, AlertCircle, Trophy, Users, Medal } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
// Removed RuleFormData import as it's not directly used for calculation here
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

// Interface for daily achievement logs (same as before)
interface DailyAchievementLog {
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
}

// Interface for leaderboard entries (same as before)
interface LeaderboardEntry {
  id: string; // Can be agentId or podId/teamId
  name: string;
  totalPoints: number;
  rank?: number;
  avatarUrl?: string;
  avatarInitials?: string;
  avatarBgColor?: string;
  isCurrentUser?: boolean;
  isCurrentUserTeam?: boolean; // Renaming to isCurrentUserPod for clarity might be better
}

// Timeframe options (same as admin dashboard)
type Timeframe = 'daily' | 'weekly' | 'monthly' | 'allTime'; // Removed 'competition' for consistency with dashboard

// Helper functions for medals and rank styles (same as before)
const getMedalColor = (rank: number) => {
  switch (rank) {
    case 1: return 'text-yellow-400';
    case 2: return 'text-gray-300';
    case 3: return 'text-orange-400';
    default: return 'text-muted-foreground';
  }
}

const getRankHighlightStyle = (rank: number): React.CSSProperties => {
  switch (rank) {
    case 1: return { backgroundColor: '#9f8f5e', color: '#ffffff' };
    case 2: return { backgroundColor: '#969696', color: '#ffffff' };
    case 3: return { backgroundColor: '#996b4f', color: '#ffffff' };
    default: return {};
  }
};


export default function AdminLeaderboardPage() {
  // State remains similar, removed selectedCompetitionId
  const [pods, setPods] = useState<Pod[]>([]);
  const [selectedPodId, setSelectedPodId] = useState<string>(''); // Can filter by pod if desired
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [timeframe, setTimeframe] = useState<Timeframe>('weekly'); // Default to weekly
  const [competitions, setCompetitions] = useState<Competition[]>([]); // Still needed for team context potentially
  const [agents, setAgents] = useState<AppUser[]>([]); // All users, will filter by pod if needed
  const [teams, setTeams] = useState<any[]>([]); // Teams context might still be useful
  const [allLogs, setAllLogs] = useState<DailyAchievementLog[]>([]);
  const [isLoadingPods, setIsLoadingPods] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true); // Combined loading
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // 1. Fetch Pods (use onSnapshot for real-time updates)
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
        setIsLoadingPods(false);
    });
     return () => unsubscribe();
  }, []);

   // 2. Fetch All Users (use onSnapshot for real-time updates)
  useEffect(() => {
     setIsLoadingData(true); // Start loading data
     const usersRef = collection(db, 'users');
     const q = query(usersRef, orderBy('name'));
     const unsubscribe = onSnapshot(q, (snapshot) => {
         const fetchedUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
         setAgents(fetchedUsers); // Store all users
         setError(null);
         // Don't set isLoadingData false yet, logs need to load
     }, (err) => {
         console.error("Error fetching users:", err);
         setError("Failed to load users data.");
         setIsLoadingData(false);
     });
     return () => unsubscribe();
  }, []);

   // 3. Fetch Competitions (still useful for team context, onSnapshot optional)
  useEffect(() => {
      // Fetch competitions once or use snapshot if needed
       const compRef = collection(db, 'competitions');
       const q = query(compRef, orderBy('startDate', 'desc'));
       const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedComps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Competition));
            setCompetitions(fetchedComps);
            setError(null);
       }, (err) => {
            console.error("Error fetching competitions:", err);
            setError("Failed to load competitions data.");
       });
        return () => unsubscribe;
  }, []);


  // 4. Fetch Achievement Logs based on Timeframe (Main Data Listener)
  useEffect(() => {
    setIsLoadingData(true); // Ensure loading state is true when timeframe changes
    setError(null);
    let unsubscribeLogs: Unsubscribe = () => {};

    const fetchDataAndListen = async () => {
        let startDate: Date | null = null;
        let endDate: Date | null = endOfDay(selectedDate); // Use selectedDate as end reference

        switch (timeframe) {
            case 'daily': startDate = startOfDay(selectedDate); break;
            case 'weekly': startDate = startOfWeek(selectedDate, { weekStartsOn: 1 }); endDate = endOfWeek(selectedDate, { weekStartsOn: 1 }); break;
            case 'monthly': startDate = startOfMonth(selectedDate); endDate = endOfMonth(selectedDate); break;
             case 'allTime': startDate = null; endDate = null; break;
        }

        const logsRef = collection(db, 'dailyAchievements');
        let logsQuery = query(logsRef); // Base query

        // Apply date filters if applicable
        if (startDate && endDate) {
             logsQuery = query(logsQuery,
                 where('date', '>=', Timestamp.fromDate(startDate)),
                 where('date', '<=', Timestamp.fromDate(endDate))
             );
        }

         // Apply pod filter if a pod is selected
         if (selectedPodId) {
             logsQuery = query(logsQuery, where('podId', '==', selectedPodId));
         }

        unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
            const fetchedLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
            setAllLogs(fetchedLogs);
            setIsLoadingData(false); // Data loaded
            setError(null);
        }, (err) => {
            console.error("Error listening to achievement logs:", err);
            setError("Failed to load real-time leaderboard data.");
            setAllLogs([]);
            setIsLoadingData(false);
        });

        // Fetch relevant teams based on the timeframe (needed for Pod Leaderboard context)
         // This logic might need refinement depending on how teams are structured and linked
         try {
             if (startDate && endDate) {
                 const relevantCompQuery = query(
                     collection(db, 'competitions'),
                     where('startDate', '<=', Timestamp.fromDate(endDate)),
                     // Can't reliably query endDate >= startDate with Firestore limitations
                     orderBy('startDate', 'desc')
                 );
                 const relevantCompSnapshot = await getDocs(relevantCompQuery);
                 const relevantTeams: any[] = [];
                 relevantCompSnapshot.docs.forEach(docSnap => {
                     const comp = docSnap.data() as Competition & { teams?: any[] };
                     if (comp.endDate.toDate() >= startDate!) {
                         // Filter teams by selectedPodId if applicable
                         if (selectedPodId && comp.podIds?.includes(selectedPodId)) {
                             relevantTeams.push(...(comp.teams || []));
                         } else if (!selectedPodId) { // Include all teams if no pod is selected
                             relevantTeams.push(...(comp.teams || []));
                         }
                     }
                 });
                 // TODO: Deduplicate teams if necessary based on team ID
                 setTeams(relevantTeams);
             } else { // All time - potentially fetch all teams? Might be too much data.
                  setTeams([]); // Or fetch all teams if feasible
             }
         } catch (teamError) {
              console.error("Error fetching teams for context:", teamError);
             // Handle team fetching error if needed
         }
    };

    // Fetch only when necessary dependencies are ready
    if (!isLoadingPods) {
        fetchDataAndListen();
    }


    return () => {
        console.log("Unsubscribing from leaderboard logs listener");
        unsubscribeLogs();
    };
  }, [selectedPodId, selectedDate, timeframe, isLoadingPods]); // Re-run when these change


  // 5. Calculate Leaderboard Scores (useMemo)
  const { agentLeaderboard, podLeaderboard } = useMemo(() => {
      // Filter agents based on selectedPodId if necessary
      const relevantAgents = selectedPodId
          ? agents.filter(agent => agent.podId === selectedPodId && agent.roles?.includes('agent'))
          : agents.filter(agent => agent.roles?.includes('agent')); // All agents if no pod selected

        // Agent calculations
      const agentScores: Record<string, number> = {};
      relevantAgents.forEach(agent => { agentScores[agent.id!] = 0; });

      allLogs.forEach(log => {
          // Only count logs for agents currently in the relevantAgents list
         if (agentScores.hasOwnProperty(log.agentId)) {
              agentScores[log.agentId] += log.points;
          }
      });

      const finalAgentLeaderboard: LeaderboardEntry[] = relevantAgents
          .map(agent => ({
              id: agent.id!,
              name: agent.name,
              totalPoints: agentScores[agent.id!] || 0,
              avatarUrl: agent.avatarUrl,
              avatarInitials: agent.avatarInitials,
              avatarBgColor: agent.avatarBgColor,
          }))
           .filter(entry => entry.totalPoints > 0) // Optional: Hide agents with 0 points
          .sort((a, b) => b.totalPoints - a.totalPoints)
          .map((entry, index) => ({ ...entry, rank: index + 1 }));

      // Pod calculations
      const podScores: Record<string, number> = {};
       // Initialize scores for all pods, or only selected pod if filtered
       const relevantPods = selectedPodId ? pods.filter(p => p.id === selectedPodId) : pods;
       relevantPods.forEach(pod => { podScores[pod.id] = 0; });

       allLogs.forEach(log => {
           // Only count logs for pods currently in the relevantPods list
           if (log.podId && podScores.hasOwnProperty(log.podId)) {
               podScores[log.podId] += log.points;
           }
       });


       const finalPodLeaderboard: LeaderboardEntry[] = relevantPods
           .map(pod => ({
              id: pod.id,
              name: pod.name,
              totalPoints: podScores[pod.id] || 0,
              avatarUrl: pod.logoUrl,
              avatarInitials: pod.logoInitials,
              avatarBgColor: pod.logoBgColor,
           }))
           .filter(entry => entry.totalPoints > 0) // Optional: Hide pods with 0 points
           .sort((a, b) => b.totalPoints - a.totalPoints)
           .map((entry, index) => ({ ...entry, rank: index + 1 }));

      return { agentLeaderboard: finalAgentLeaderboard, podLeaderboard: finalPodLeaderboard };
  }, [allLogs, agents, pods, selectedPodId]); // Updated dependencies

  const isLoading = isLoadingPods || isLoadingData;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Leaderboards</CardTitle>
          <CardDescription>View agent and pod rankings based on accumulated points.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Selection Controls */}
          <div className="flex flex-wrap gap-4 mb-6 items-end">
            {/* Pod Select (Optional Filter) */}
            <div className="grid gap-2">
              <Label htmlFor="pod-select">Filter by Pod (Optional)</Label>
              <Select onValueChange={(value) => setSelectedPodId(value === 'all' ? '' : value)} value={selectedPodId || 'all'} disabled={isLoadingPods || isLoadingData}>
                <SelectTrigger id="pod-select" className="w-[200px]">
                  <SelectValue placeholder={isLoadingPods ? "Loading..." : "All Pods"} />
                </SelectTrigger>
                <SelectContent>
                   <SelectItem value="all">All Pods</SelectItem>
                  {pods.map(pod => (
                    <SelectItem key={pod.id} value={pod.id}>{pod.name}</SelectItem>
                  ))}
                  {pods.length === 0 && !isLoadingPods && <SelectItem value="-" disabled>No pods found</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {/* Timeframe Select */}
            <div className="grid gap-2">
              <Label htmlFor="timeframe-select">Timeframe</Label>
              <Select onValueChange={(value) => setTimeframe(value as Timeframe)} value={timeframe} disabled={isLoadingData}>
                <SelectTrigger id="timeframe-select" className="w-[180px]">
                  <SelectValue placeholder="Select Timeframe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Today</SelectItem>
                  <SelectItem value="weekly">This Week</SelectItem>
                  <SelectItem value="monthly">This Month</SelectItem>
                  <SelectItem value="allTime">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Select (for Daily/Weekly/Monthly) */}
            {(timeframe === 'daily' || timeframe === 'weekly' || timeframe === 'monthly') && (
                <div className="grid gap-2">
                <Label htmlFor="date-select">Reference Date</Label>
                <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        id="date-select"
                        variant={"outline"}
                        className={cn("w-[200px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                        disabled={isLoadingData}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(startOfDay(date))}
                        initialFocus
                    />
                    </PopoverContent>
                </Popover>
                </div>
            )}

          </div>

          {error && <p className="text-destructive mb-4">{error}</p>}

          {/* Leaderboard Tables */}
          {isLoading ? (
            <div className="grid md:grid-cols-2 gap-6">
                <Skeleton className="h-[400px] w-full" />
                <Skeleton className="h-[400px] w-full" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Agent Leaderboard */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg font-semibold">Agent Leaderboard</CardTitle>
                     <Users className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                   {agentLeaderboard.length === 0 ? (
                       <p className="text-muted-foreground text-center py-4">No agent data available for this period{selectedPodId ? ` in ${pods.find(p=>p.id===selectedPodId)?.name}` : ''}.</p>
                   ) : (
                    <Table>
                        <TableHeader>
                        <TableRow>{/* Remove whitespace here */}
                            <TableHead className="w-[50px]">Rank</TableHead>
                            <TableHead>Agent</TableHead>
                            <TableHead className="text-right">Total Points</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {agentLeaderboard.map((entry) => (
                             <TableRow
                                key={entry.id}
                                style={getRankHighlightStyle(entry.rank ?? 0)}
                                className={cn(
                                    // entry.isCurrentUser handled in admin dashboard if needed, removed here
                                    (entry.rank ?? 0) <= 3 ? 'hover:brightness-110' : 'hover:bg-muted/50'
                                )}
                             >
                            <TableCell className="font-medium text-center align-middle">
                                {(entry.rank ?? 0) <= 3 ? (
                                    <Medal className={cn("inline-block h-5 w-5", getMedalColor(entry.rank ?? 0))} />
                                ) : (
                                    entry.rank
                                )}
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                     <Avatar className="h-7 w-7">
                                         {entry.avatarUrl ? (
                                            <AvatarImage src={entry.avatarUrl} alt={entry.name} />
                                         ) : (
                                             <AvatarFallback
                                                initials={entry.avatarInitials || generateInitials(entry.name)}
                                                backgroundColor={entry.avatarBgColor}
                                                className={cn((entry.rank ?? 0) <= 3 ? 'text-gray-800' : '')}
                                             >
                                                 {!entry.avatarInitials && generateInitials(entry.name)}
                                             </AvatarFallback>
                                         )}
                                     </Avatar>
                                     <span className={cn("truncate", (entry.rank ?? 0) <= 3 ? 'text-white' : '')}>{entry.name}</span>
                                     {/* Removed isCurrentUser badge */}
                                 </div>
                            </TableCell>
                            <TableCell className={cn("text-right font-semibold", (entry.rank ?? 0) <= 3 ? 'text-white' : 'text-primary')}>
                                {entry.totalPoints.toLocaleString()}
                            </TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                    )}
                </CardContent>
              </Card>

              {/* Pod Leaderboard */}
              <Card>
                 <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg font-semibold">Pod Leaderboard</CardTitle>
                     <Trophy className="h-5 w-5 text-muted-foreground" />
                 </CardHeader>
                <CardContent>
                    {podLeaderboard.length === 0 ? (
                         <p className="text-muted-foreground text-center py-4">No pod data available for this period{selectedPodId ? ` for ${pods.find(p=>p.id===selectedPodId)?.name}` : ''}.</p>
                    ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>{/* Remove whitespace here */}
                                <TableHead className="w-[50px]">Rank</TableHead>
                                <TableHead>Pod</TableHead> {/* Changed from Team */}
                                <TableHead className="text-right">Total Points</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {podLeaderboard.map((entry) => (
                             <TableRow
                                key={entry.id}
                                style={getRankHighlightStyle(entry.rank ?? 0)}
                                className={cn(
                                     // isCurrentUserTeam relevance depends on context, removed for admin view
                                     (entry.rank ?? 0) <= 3 ? 'hover:brightness-110' : 'hover:bg-muted/50'
                                 )}
                             >
                            <TableCell className="font-medium text-center align-middle">
                                {(entry.rank ?? 0) <= 3 ? (
                                     <Medal className={cn("inline-block h-5 w-5", getMedalColor(entry.rank ?? 0))} />
                                 ) : (
                                     entry.rank
                                )}
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-7 w-7">
                                         {entry.avatarUrl ? (
                                            <AvatarImage src={entry.avatarUrl} alt={entry.name} />
                                         ) : (
                                             <AvatarFallback
                                                initials={entry.avatarInitials || generateInitials(entry.name)}
                                                backgroundColor={entry.avatarBgColor}
                                                className={cn((entry.rank ?? 0) <= 3 ? 'text-gray-800' : '')}
                                             >
                                                 {!entry.avatarInitials && generateInitials(entry.name)}
                                             </AvatarFallback>
                                         )}
                                     </Avatar>
                                    <span className={cn("font-medium", (entry.rank ?? 0) <= 3 ? 'text-white' : '')}>
                                        {entry.name}
                                        {/* Removed isCurrentUserTeam badge */}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell className={cn("text-right font-semibold", (entry.rank ?? 0) <= 3 ? 'text-white' : 'text-primary')}>
                                {entry.totalPoints.toLocaleString()}
                            </TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                    )}
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
