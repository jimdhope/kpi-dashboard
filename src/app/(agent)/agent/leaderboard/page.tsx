
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
import { db, auth } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { CalendarIcon, Loader2, AlertCircle, Trophy, Users, Medal } from 'lucide-react'; // Added Medal
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils'; // Import cn
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import { Badge } from '@/components/ui/badge'; // Import Badge

// Interfaces (same as admin)
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

interface LeaderboardEntry {
  id: string;
  name: string;
  totalPoints: number;
  rank?: number;
  avatarUrl?: string;
  avatarInitials?: string;
  avatarBgColor?: string;
  isCurrentUser?: boolean; // Flag for the logged-in agent
  isCurrentUserTeam?: boolean; // Flag for the logged-in agent's team
}

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

export default function AgentLeaderboardPage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [agentPodId, setAgentPodId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [timeframe, setTimeframe] = useState<Timeframe>('daily');
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [podAgents, setPodAgents] = useState<AppUser[]>([]); // Agents within the user's pod
  const [teams, setTeams] = useState<any[]>([]);
  const [allLogs, setAllLogs] = useState<DailyAchievementLog[]>([]);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // 1. Get current user and their pod ID (use onSnapshot for potential pod changes)
  useEffect(() => {
    setIsLoadingUser(true);
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
       let unsubscribeUserDoc: Unsubscribe = () => {}; // Initialize for cleanup
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
              setError(null);
            }
          } else {
             setError("Could not find your user profile.");
             setCurrentUser(null);
             setAgentPodId(null);
          }
           setIsLoadingUser(false); // User data loaded/updated
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
        // Return the inner unsubscribe function for the doc listener
       return unsubscribeUserDoc;
    });
     // Return the outer unsubscribe function for the auth listener
    return () => unsubscribeAuth();
  }, []);


  // 2. Fetch Competitions for the agent's pod (can remain getDocs)
  useEffect(() => {
      if (!agentPodId) {
          setCompetitions([]);
          setSelectedCompetitionId('');
          return;
      }
       setIsLoadingData(true);
       const compRef = collection(db, 'competitions');
       const q = query(compRef, where('podIds', 'array-contains', agentPodId), orderBy('startDate', 'desc')); // Updated query
       getDocs(q)
          .then((snapshot) => {
              setCompetitions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Competition)));
               setError(null);
          })
          .catch(err => {
              console.error("Error fetching competitions:", err);
              setError("Failed to load competitions for your pod.");
          })
           .finally(() => {
              // Loading state handled by the main data fetching effect
           });
  }, [agentPodId]);


  // 3. Fetch Agents, Teams, and Listen to Logs
  useEffect(() => {
    if (!agentPodId || isLoadingUser) {
      setPodAgents([]);
      setTeams([]);
      setAllLogs([]);
       if(!isLoadingUser && !agentPodId) setIsLoadingData(false);
      return () => {};
    }

    setIsLoadingData(true);
    setError(null);
    let unsubscribeLogs: Unsubscribe = () => {};

    const fetchDataAndListen = async () => {
      try {
        // Fetch Agents in the pod (can remain getDocs)
        const usersRef = collection(db, 'users');
        const agentsQuery = query( usersRef, where('podId', '==', agentPodId), where('roles', 'array-contains', 'agent'), orderBy('name') );
        const agentsSnapshot = await getDocs(agentsQuery);
        setPodAgents(agentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)));

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
                 setTeams(compDocSnap.exists() ? (compDocSnap.data() as Competition & { teams?: any[] }).teams || [] : []);
            } else {
                 setError("Selected competition not found.");
                 setIsLoadingData(false);
                 return;
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
            const relevantCompQuery = query( competitionsRef, where('podIds', 'array-contains', agentPodId), where('startDate', '<=', Timestamp.fromDate(endDate!)), orderBy('startDate', 'desc') ); // Use array-contains
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

        // Listen to Logs
        if (startDate && endDate) {
            const logsRef = collection(db, 'dailyAchievements');
            const logsQuery = query(
                logsRef,
                where('podId', '==', agentPodId), // Filter by user's pod
                where('date', '>=', Timestamp.fromDate(startDate)),
                where('date', '<=', Timestamp.fromDate(endDate))
                 // REMOVED: where('competitionId', '==', competitionIdForLogs) - filter client-side
            );

             unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
                 let fetchedLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));

                 // Client-side filter if timeframe is 'competition' and ID is known
                 if (timeframe === 'competition' && competitionIdForLogs) {
                     fetchedLogs = fetchedLogs.filter(log => log.competitionId === competitionIdForLogs);
                 }

                 setAllLogs(fetchedLogs);
                 setIsLoadingData(false);
                 setError(null);
             }, (err) => {
                 console.error("Error listening to achievement logs:", err);
                 setError("Failed to load real-time leaderboard data.");
                 setAllLogs([]);
                 setIsLoadingData(false);
             });
        } else {
            setAllLogs([]);
            setIsLoadingData(false);
             if(timeframe === 'competition' && !selectedCompetitionId) { /* Prompt handled in render */ }
             else if (timeframe !== 'competition') { setError("Invalid date range calculated."); }
        }

      } catch (err) {
        console.error("Error fetching initial leaderboard data:", err);
        setError("Failed to load leaderboard data.");
        setPodAgents([]);
        setTeams([]);
        setAllLogs([]);
        setIsLoadingData(false);
      }
    };

     // Ensure competitions are loaded before fetching other data if timeframe is 'competition'
    if (timeframe === 'competition' && competitions.length === 0 && !isLoadingData) {
        // Only fetch if competitions are loaded OR if initial data load is not happening
        if(competitions.length > 0 || !isLoadingData){ fetchDataAndListen(); }
    } else {
       fetchDataAndListen();
    }

     return () => {
         console.log("Unsubscribing from agent leaderboard logs listener");
         unsubscribeLogs();
     };
   // Dependencies now include currentUser?.id to refetch if user changes
  }, [agentPodId, selectedDate, timeframe, selectedCompetitionId, competitions, isLoadingUser, currentUser?.id]);


  // 4. Calculate Leaderboard Scores (Memoization remains the same)
  const { agentLeaderboard, teamLeaderboard } = useMemo(() => {
    // Agent calculations
    const agentScores: Record<string, number> = {};
    podAgents.forEach(agent => { agentScores[agent.id!] = 0; });

    allLogs.forEach(log => {
      if (agentScores.hasOwnProperty(log.agentId)) {
        agentScores[log.agentId] += log.points;
      }
    });

    const finalAgentLeaderboard: LeaderboardEntry[] = podAgents
      .map(agent => ({
        id: agent.id!,
        name: agent.name,
        totalPoints: agentScores[agent.id!] || 0,
        avatarUrl: agent.avatarUrl,
        avatarInitials: agent.avatarInitials,
        avatarBgColor: agent.avatarBgColor,
        isCurrentUser: agent.id === currentUser?.id // Flag current user
      }))
       // Removed filter: .filter(entry => entry.totalPoints > 0)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    // Team calculations
    const teamScores: Record<string, number> = {};
    teams.forEach(team => { teamScores[team.id] = 0; });

    allLogs.forEach(log => {
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
        // Identify user's team
        isCurrentUserTeam: team.agentIds?.includes(currentUser?.id || '')
      }))
       // Removed filter: .filter(entry => entry.totalPoints > 0)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    return { agentLeaderboard: finalAgentLeaderboard, teamLeaderboard: finalTeamLeaderboard };
  }, [allLogs, podAgents, teams, currentUser?.id]);


  const isLoading = isLoadingUser || isLoadingData;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Leaderboards</CardTitle>
          <CardDescription>See how you and your team rank against others in the pod.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Selection Controls */}
          <div className="flex flex-wrap gap-4 mb-6 items-end">
            {/* Timeframe Select */}
            <div className="grid gap-2">
              <Label htmlFor="timeframe-select">Timeframe</Label>
              <Select onValueChange={(value) => setTimeframe(value as Timeframe)} value={timeframe} disabled={isLoading}>
                <SelectTrigger id="timeframe-select" className="w-[180px]">
                  <SelectValue placeholder="Select Timeframe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="competition" disabled={!agentPodId || competitions.length === 0}>
                    Competition {(!agentPodId || competitions.length === 0) ? '(No Comps)' : ''}
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
                        disabled={isLoading}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50"> {/* Added z-50 */}
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
                    disabled={isLoading || competitions.length === 0}
                >
                    <SelectTrigger id="competition-select" className="w-[250px]">
                    <SelectValue placeholder={competitions.length === 0 ? "No competitions found" : "Select Competition"} />
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
          ) : !agentPodId ? (
             <p className="text-center text-muted-foreground mt-6">You are not assigned to a pod. Leaderboards unavailable.</p>
          ) : timeframe === 'competition' && !selectedCompetitionId && competitions.length > 0 ? (
             <p className="text-center text-muted-foreground mt-6">Please select a competition.</p>
          ) : (podAgents.length === 0 && !error && agentPodId) ? (
             <p className="text-center text-muted-foreground mt-6">No agents found in your pod.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Agent Leaderboard */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg font-semibold">Agent Leaderboard</CardTitle>
                     <Users className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                   {agentLeaderboard.length === 0 && allLogs.length > 0 ? (
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
                                                // Use a very dark color for fallbacks on light rank backgrounds
                                                className={cn((entry.rank ?? 0) <= 3 ? 'text-gray-900' : '')}
                                             >
                                                 {!entry.avatarInitials && generateInitials(entry.name)}
                                             </AvatarFallback>
                                         )}
                                     </Avatar>
                                      {/* Ensure name text color contrasts with rank background (explicitly white) */}
                                     <span className={cn("truncate", (entry.rank ?? 0) <= 3 ? 'text-white' : '')}>{entry.name}</span>
                                     {entry.isCurrentUser && <Badge variant={(entry.rank ?? 0) <= 3 ? "secondary" : "outline"} className={cn("ml-2", (entry.rank ?? 0) <= 3 ? "border-white/50 text-white/90" : "")}>You</Badge>}
                                 </div>
                            </TableCell>
                            {/* Ensure score text color contrasts with rank background (explicitly white) */}
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
                            {/* Ensure name text color contrasts with rank background (explicitly white) */}
                            <TableCell className={cn("font-medium", (entry.rank ?? 0) <= 3 ? 'text-white' : '')}>
                                {entry.name}
                                {entry.isCurrentUserTeam && <Badge variant={(entry.rank ?? 0) <= 3 ? "secondary" : "outline"} className={cn("ml-2", (entry.rank ?? 0) <= 3 ? "border-white/50 text-white/90" : "")}>Your Team</Badge>}
                            </TableCell>
                            {/* Ensure score text color contrasts with rank background (explicitly white) */}
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


