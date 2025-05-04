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
  onSnapshot, // Import onSnapshot
  Unsubscribe, // Import Unsubscribe
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { CalendarIcon, Loader2, AlertCircle, Trophy, Users, Medal } from 'lucide-react'; // Added Medal
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from 'date-fns';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils'; // Import cn
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; // Import Avatar components
import { generateInitials } from '@/lib/utils'; // Import generateInitials
import { Badge } from '@/components/ui/badge'; // Import Badge

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

// Interface for leaderboard entries
interface LeaderboardEntry {
  id: string; // Can be agentId or teamId
  name: string;
  totalPoints: number;
  rank?: number; // Rank will be calculated
  avatarUrl?: string; // Optional avatar for agents/teams
  avatarInitials?: string;
  avatarBgColor?: string;
  isCurrentUser?: boolean; // Flag for highlighting in agent view (might not be used here but keep for consistency)
  isCurrentUserTeam?: boolean; // Flag for highlighting team in agent view
}

// Timeframe options
type Timeframe = 'daily' | 'weekly' | 'monthly' | 'competition';

// Helper function to get medal color class
const getMedalColor = (rank: number) => {
  switch (rank) {
    case 1: return 'text-yellow-400'; // Gold
    case 2: return 'text-gray-300'; // Silver
    case 3: return 'text-orange-400'; // Bronze
    default: return 'text-muted-foreground';
  }
}

// Helper function to get style for top ranks
const getRankHighlightStyle = (rank: number): React.CSSProperties => {
  switch (rank) {
    case 1: return { backgroundColor: '#9f8f5e', color: '#ffffff' }; // Gold-ish background, white text
    case 2: return { backgroundColor: '#969696', color: '#ffffff' }; // Silver-ish background, white text
    case 3: return { backgroundColor: '#996b4f', color: '#ffffff' }; // Bronze-ish background, white text
    default: return {}; // No special style for other ranks
  }
};


export default function AdminLeaderboardPage() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date())); // Used for daily/weekly/monthly calculation start point
  const [timeframe, setTimeframe] = useState<Timeframe>('daily');
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>(''); // Only used when timeframe is 'competition'
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [teams, setTeams] = useState<any[]>([]); // Structure depends on how teams are stored in Competition doc
  const [allLogs, setAllLogs] = useState<DailyAchievementLog[]>([]); // Store all relevant logs
  const [isLoadingPods, setIsLoadingPods] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false); // Combined loading state
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // 1. Fetch Pods (can remain getDocs or use onSnapshot if pods change frequently)
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

  // 2. Fetch Competitions for the selected Pod (can remain getDocs)
  useEffect(() => {
      if (!selectedPodId) {
          setCompetitions([]);
          setSelectedCompetitionId(''); // Reset competition selection
          return;
      }
      setIsLoadingData(true); // Start loading when pod changes
      const compRef = collection(db, 'competitions');
      const q = query(compRef, where('podIds', 'array-contains', selectedPodId), orderBy('startDate', 'desc')); // Updated query
      getDocs(q)
          .then((snapshot) => {
              const fetchedComps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Competition));
              setCompetitions(fetchedComps);
              // Optionally auto-select the latest competition if timeframe is 'competition'?
              setError(null);
          })
          .catch(err => {
              console.error("Error fetching competitions:", err);
              setError("Failed to load competitions for the pod.");
          })
          .finally(() => {
              // Don't set loading false yet, main data fetch below needs this
          });
  }, [selectedPodId]);


  // 3. Fetch Agents, Teams, and Listen to All Relevant Logs
  useEffect(() => {
    if (!selectedPodId) {
      setAgents([]);
      setTeams([]);
      setAllLogs([]);
      setIsLoadingData(false);
      return () => {}; // Return empty cleanup
    }

    setIsLoadingData(true);
    setError(null);
    let unsubscribeLogs: Unsubscribe = () => {};

    const fetchDataAndListen = async () => {
      try {
        // Fetch Agents (can remain getDocs)
        const usersRef = collection(db, 'users');
        const agentsQuery = query(
            usersRef,
            where('podId', '==', selectedPodId),
            where('roles', 'array-contains', 'agent'),
            orderBy('name')
        );
        const agentsSnapshot = await getDocs(agentsQuery);
        const fetchedAgents = agentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
        setAgents(fetchedAgents);

        let startDate: Date | null = null;
        let endDate: Date | null = null;
        let competitionIdForLogs: string | null = null;

        // Determine date range and competition ID
        if (timeframe === 'competition' && selectedCompetitionId) {
            const competition = competitions.find(c => c.id === selectedCompetitionId);
            if (competition) {
                startDate = competition.startDate.toDate();
                endDate = competition.endDate.toDate();
                competitionIdForLogs = competition.id;
                const compDocRef = doc(db, 'competitions', selectedCompetitionId);
                const compDocSnap = await getDoc(compDocRef);
                 if (compDocSnap.exists()) {
                     const compData = compDocSnap.data() as Competition & { teams?: any[] };
                     setTeams(compData.teams || []);
                 } else {
                     setTeams([]);
                 }
            } else {
                 setError("Selected competition not found.");
                 setIsLoadingData(false);
                 return; // Stop if competition data is missing
            }
        } else if (timeframe !== 'competition') {
             const now = selectedDate;
            switch (timeframe) {
                case 'daily': startDate = startOfDay(now); endDate = endOfDay(now); break;
                case 'weekly': startDate = startOfWeek(now, { weekStartsOn: 1 }); endDate = endOfWeek(now, { weekStartsOn: 1 }); break;
                case 'monthly': startDate = startOfMonth(now); endDate = endOfMonth(now); break;
            }
             // Fetch teams from relevant competition
              const competitionsRef = collection(db, 'competitions');
              const relevantCompQuery = query( competitionsRef, where('podIds', 'array-contains', selectedPodId), where('startDate', '<=', Timestamp.fromDate(endDate!)), orderBy('startDate', 'desc') ); // Use array-contains
              const relevantCompSnapshot = await getDocs(relevantCompQuery);
              let relevantCompetition: (Competition & { id: string, teams?: any[] }) | null = null;
              for (const docSnap of relevantCompSnapshot.docs) {
                 const comp = { id: docSnap.id, ...docSnap.data() } as Competition & { id: string, teams?: any[] };
                  if (comp.endDate.toDate() >= startDate!) {
                     relevantCompetition = comp; break;
                 }
              }
              setTeams(relevantCompetition?.teams || []);
              competitionIdForLogs = relevantCompetition?.id || null;
        }

        // Set up Listener for Logs based on determined criteria
        if (startDate && endDate) {
            const logsRef = collection(db, 'dailyAchievements');
            const logsQuery = query(
                logsRef,
                where('podId', '==', selectedPodId),
                where('date', '>=', Timestamp.fromDate(startDate)),
                where('date', '<=', Timestamp.fromDate(endDate))
                 // Optional: Filter by competition only if timeframe is 'competition' AND an ID exists
                 // REMOVED: where('competitionId', '==', competitionIdForLogs) because it might fail if competitionIdForLogs is null
                 // Instead, filter client-side if needed, or ensure competitionIdForLogs is always valid when timeframe is 'competition'
            );

             unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
                 let fetchedLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));

                 // Client-side filter if timeframe is 'competition' and ID is known
                 if (timeframe === 'competition' && competitionIdForLogs) {
                     fetchedLogs = fetchedLogs.filter(log => log.competitionId === competitionIdForLogs);
                 }

                 setAllLogs(fetchedLogs);
                 setIsLoadingData(false); // Data updated
                 setError(null); // Clear error on success
             }, (err) => {
                 console.error("Error listening to achievement logs:", err);
                 setError("Failed to load real-time leaderboard data.");
                 setAllLogs([]); // Clear logs on error
                 setIsLoadingData(false);
             });
        } else {
             // Handle cases where date range is invalid or no competition selected
             setAllLogs([]);
             setIsLoadingData(false);
             if(timeframe === 'competition' && !selectedCompetitionId) {
                // Don't set an error, just show the prompt to select a competition
             } else if (timeframe !== 'competition') {
                 setError("Invalid date range calculated.");
             }
        }

      } catch (err) {
        console.error("Error fetching initial leaderboard data:", err);
        setError("Failed to load leaderboard data.");
        setAgents([]);
        setTeams([]);
        setAllLogs([]);
        setIsLoadingData(false); // Ensure loading stops on catch
      }
       // Don't set loading false finally, listener will handle it
    };

    fetchDataAndListen();

     // Cleanup listener on unmount or when dependencies change
     return () => {
         console.log("Unsubscribing from leaderboard logs listener");
         unsubscribeLogs();
     };
  }, [selectedPodId, selectedDate, timeframe, selectedCompetitionId, competitions]); // Re-run when these change


  // 4. Calculate Leaderboard Scores (Memoization remains the same)
  const { agentLeaderboard, teamLeaderboard } = useMemo(() => {
    // Agent calculations
    const agentScores: Record<string, number> = {};
    agents.forEach(agent => { agentScores[agent.id!] = 0; }); // Initialize all agents in the pod

    allLogs.forEach(log => {
      if (agentScores.hasOwnProperty(log.agentId)) {
        agentScores[log.agentId] += log.points;
      }
    });

    const finalAgentLeaderboard: LeaderboardEntry[] = agents
      .map(agent => ({
        id: agent.id!,
        name: agent.name,
        totalPoints: agentScores[agent.id!] || 0,
        avatarUrl: agent.avatarUrl,
        avatarInitials: agent.avatarInitials,
        avatarBgColor: agent.avatarBgColor,
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((entry, index) => ({ ...entry, rank: index + 1 })); // Assign ranks

    // Team calculations
    const teamScores: Record<string, number> = {};
    teams.forEach(team => { teamScores[team.id] = 0; }); // Initialize teams

    allLogs.forEach(log => {
      // Find which team the agent belongs to *within the context of the selected competition/timeframe*
      const agentTeam = teams.find(team => team.agentIds?.includes(log.agentId));
      if (agentTeam && teamScores.hasOwnProperty(agentTeam.id)) {
        teamScores[agentTeam.id] += log.points;
      }
    });

    const finalTeamLeaderboard: LeaderboardEntry[] = teams
      .map(team => ({
        id: team.id,
        name: team.name,
        totalPoints: teamScores[team.id] || 0,
        // TODO: Add avatar info for teams if available (e.g., based on pod logo?)
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    return { agentLeaderboard: finalAgentLeaderboard, teamLeaderboard: finalTeamLeaderboard };
  }, [allLogs, agents, teams]);

  const isLoading = isLoadingPods || isLoadingData;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Leaderboards</CardTitle>
          <CardDescription>View agent and team rankings based on accumulated points.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Selection Controls */}
          <div className="flex flex-wrap gap-4 mb-6 items-end">
            {/* Pod Select */}
            <div className="grid gap-2">
              <Label htmlFor="pod-select">Pod</Label>
              <Select onValueChange={setSelectedPodId} value={selectedPodId} disabled={isLoadingPods || isLoadingData}>
                <SelectTrigger id="pod-select" className="w-[200px]">
                  <SelectValue placeholder={isLoadingPods ? "Loading..." : "Select Pod"} />
                </SelectTrigger>
                <SelectContent>
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
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="competition" disabled={!selectedPodId || competitions.length === 0}>
                     Competition {(!selectedPodId || competitions.length === 0) ? '(Select Pod)' : ''}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Select (for Daily/Weekly/Monthly) */}
            {timeframe !== 'competition' && (
                <div className="grid gap-2">
                <Label htmlFor="date-select">Reference Date</Label>
                <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        id="date-select"
                        variant={"outline"}
                        className={cn(
                        "w-[200px] justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                        )}
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

             {/* Competition Select (for Competition timeframe) */}
            {timeframe === 'competition' && (
                <div className="grid gap-2">
                <Label htmlFor="competition-select">Competition</Label>
                <Select
                    onValueChange={setSelectedCompetitionId}
                    value={selectedCompetitionId}
                    disabled={isLoadingData || competitions.length === 0}
                >
                    <SelectTrigger id="competition-select" className="w-[250px]">
                    <SelectValue placeholder={competitions.length === 0 ? "No competitions in pod" : "Select Competition"} />
                    </SelectTrigger>
                    <SelectContent>
                    {competitions.map(comp => (
                        <SelectItem key={comp.id} value={comp.id}>
                        {comp.name} ({format(comp.startDate.toDate(), 'PP')} - {format(comp.endDate.toDate(), 'PP')})
                        </SelectItem>
                    ))}
                    </SelectContent>
                </Select>
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
          ) : !selectedPodId ? (
             <p className="text-center text-muted-foreground mt-6">Please select a pod to view leaderboards.</p>
          ) : timeframe === 'competition' && !selectedCompetitionId && competitions.length > 0 ? ( // Show prompt only if comps exist
             <p className="text-center text-muted-foreground mt-6">Please select a competition.</p>
          ) : (agents.length === 0 && !error && selectedPodId) ? ( // Ensure pod is selected before showing no agents
             <p className="text-center text-muted-foreground mt-6">No agents found in the selected pod.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Agent Leaderboard */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg font-semibold">Agent Leaderboard</CardTitle>
                     <Users className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                   {agentLeaderboard.length === 0 && allLogs.length > 0 ? ( // Show if logs exist but no scores (shouldn't happen often)
                        <p className="text-muted-foreground text-center py-4">Processing scores...</p>
                   ) : agentLeaderboard.length === 0 ? (
                       <p className="text-muted-foreground text-center py-4">No agent data available for this period.</p>
                   ) : (
                    <Table>
                        <TableHeader>
                        <TableRow>
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
                                    entry.isCurrentUser && (entry.rank ?? 0) > 3 ? 'bg-accent' : '', // Highlight current user if not top 3
                                    (entry.rank ?? 0) <= 3 ? 'hover:brightness-110' : 'hover:bg-muted/50' // Adjust hover for top ranks
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
                                                className={cn((entry.rank ?? 0) <= 3 ? 'text-gray-800' : '')} // Contrast for rank background
                                             >
                                                 {!entry.avatarInitials && generateInitials(entry.name)}
                                             </AvatarFallback>
                                         )}
                                     </Avatar>
                                     <span className={cn("truncate", (entry.rank ?? 0) <= 3 ? 'text-white' : '')}>{entry.name}</span>
                                      {entry.isCurrentUser && <Badge variant={(entry.rank ?? 0) <= 3 ? "secondary" : "outline"} className={(entry.rank ?? 0) <= 3 ? "border-white/50 text-white/90" : ""}>You</Badge>}
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

              {/* Team Leaderboard */}
              <Card>
                 <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg font-semibold">Team Leaderboard</CardTitle>
                     <Trophy className="h-5 w-5 text-muted-foreground" />
                 </CardHeader>
                <CardContent>
                    {teams.length === 0 ? (
                         <p className="text-muted-foreground text-center py-4">No teams defined for this period.</p>
                    ) : teamLeaderboard.length === 0 && allLogs.length > 0 ? (
                        <p className="text-muted-foreground text-center py-4">Processing team scores...</p>
                    ) : teamLeaderboard.length === 0 ? (
                         <p className="text-muted-foreground text-center py-4">No team data available for this period.</p>
                    ) : (
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">Rank</TableHead>
                            <TableHead>Team</TableHead>
                            <TableHead className="text-right">Total Points</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {teamLeaderboard.map((entry) => (
                             <TableRow
                                key={entry.id}
                                style={getRankHighlightStyle(entry.rank ?? 0)}
                                className={cn(
                                     entry.isCurrentUserTeam && (entry.rank ?? 0) > 3 ? 'bg-accent' : '', // Highlight current user's team if not top 3
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
                            <TableCell className={cn("font-medium", (entry.rank ?? 0) <= 3 ? 'text-white' : '')}>
                                {entry.name}
                                 {entry.isCurrentUserTeam && <Badge variant={(entry.rank ?? 0) <= 3 ? "secondary" : "outline"} className={cn("ml-2", (entry.rank ?? 0) <= 3 ? "border-white/50 text-white/90" : "")}>Your Team</Badge>}
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
