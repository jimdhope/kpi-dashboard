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
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { CalendarIcon, Loader2, AlertCircle, Trophy, Users } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from 'date-fns';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; // Import Avatar components
import { generateInitials } from '@/lib/utils'; // Import generateInitials

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
}

// Timeframe options
type Timeframe = 'daily' | 'weekly' | 'monthly' | 'competition';

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

  // 1. Fetch Pods
  useEffect(() => {
    setIsLoadingPods(true);
    const podsRef = collection(db, 'pods');
    const q = query(podsRef, orderBy('name'));
    getDocs(q)
      .then((snapshot) => {
        const fetchedPods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pod));
        setPods(fetchedPods);
        setError(null);
      })
      .catch(err => {
        console.error("Error fetching pods:", err);
        setError("Failed to load pods.");
      })
      .finally(() => setIsLoadingPods(false));
  }, []);

  // 2. Fetch Competitions for the selected Pod (to allow competition-specific timeframe)
  useEffect(() => {
      if (!selectedPodId) {
          setCompetitions([]);
          setSelectedCompetitionId(''); // Reset competition selection
          return;
      }
      setIsLoadingData(true); // Start loading when pod changes
      const compRef = collection(db, 'competitions');
      // Fetch all competitions for the pod, ordered by start date
      const q = query(compRef, where('podId', '==', selectedPodId), orderBy('startDate', 'desc'));
      getDocs(q)
          .then((snapshot) => {
              const fetchedComps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Competition));
              setCompetitions(fetchedComps);
              // Optionally auto-select the latest competition if timeframe is 'competition'?
              // if (timeframe === 'competition' && fetchedComps.length > 0) {
              //     setSelectedCompetitionId(fetchedComps[0].id);
              // }
              setError(null);
          })
          .catch(err => {
              console.error("Error fetching competitions:", err);
              setError("Failed to load competitions for the pod.");
          })
          .finally(() => {
              // Don't set loading false yet, data fetch below needs this
          });
  }, [selectedPodId]);


  // 3. Fetch Agents, Teams, and All Relevant Logs based on Pod and Timeframe/Competition
  useEffect(() => {
    if (!selectedPodId) {
      setAgents([]);
      setTeams([]);
      setAllLogs([]);
      setIsLoadingData(false); // Ensure loading stops if no pod selected
      return;
    }

    setIsLoadingData(true); // Set loading true at the start of data fetch
    setError(null);

    const fetchData = async () => {
      try {
        // Fetch Agents
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

        // Determine date range and competition ID for log query
        if (timeframe === 'competition' && selectedCompetitionId) {
            const competition = competitions.find(c => c.id === selectedCompetitionId);
            if (competition) {
                startDate = competition.startDate.toDate();
                endDate = competition.endDate.toDate();
                competitionIdForLogs = competition.id;
                // Fetch teams defined within this specific competition
                const compDocRef = doc(db, 'competitions', selectedCompetitionId);
                const compDocSnap = await getDoc(compDocRef);
                 if (compDocSnap.exists()) {
                     const compData = compDocSnap.data() as Competition & { teams?: any[] };
                     setTeams(compData.teams || []);
                 } else {
                     setTeams([]); // No teams found in competition doc
                 }
            } else {
                 setError("Selected competition not found.");
                 setIsLoadingData(false);
                 return; // Stop if competition data is missing
            }
        } else if (timeframe !== 'competition') {
            // Calculate date range for daily, weekly, monthly
             const now = selectedDate; // Use selectedDate as the reference point
            switch (timeframe) {
                case 'daily':
                    startDate = startOfDay(now);
                    endDate = endOfDay(now);
                    break;
                case 'weekly':
                     startDate = startOfWeek(now, { weekStartsOn: 1 }); // Assuming week starts Monday
                     endDate = endOfWeek(now, { weekStartsOn: 1 });
                    break;
                case 'monthly':
                     startDate = startOfMonth(now);
                     endDate = endOfMonth(now);
                    break;
            }
             // Fetch logs based on date range, but need to potentially find the *relevant* competition for team association
             // This gets tricky. For simplicity now, we'll fetch logs based on date range *only*.
             // Team association might be incorrect if multiple competitions overlap the range.
             // A better approach might involve iterating competitions or storing teamId directly in logs.
             // For now, we'll fetch teams from the *most recent* competition active within the date range.

              const competitionsRef = collection(db, 'competitions');
              const relevantCompQuery = query(
                 competitionsRef,
                 where('podId', '==', selectedPodId),
                 where('startDate', '<=', Timestamp.fromDate(endDate!)), // Started before or on the end date
                 orderBy('startDate', 'desc')
              );
              const relevantCompSnapshot = await getDocs(relevantCompQuery);
              let relevantCompetition: (Competition & { id: string, teams?: any[] }) | null = null;
              for (const docSnap of relevantCompSnapshot.docs) {
                 const comp = { id: docSnap.id, ...docSnap.data() } as Competition & { id: string, teams?: any[] };
                  if (comp.endDate.toDate() >= startDate!) { // Ended on or after the start date
                     relevantCompetition = comp;
                     break; // Found the most recent relevant one
                 }
              }
              if (relevantCompetition) {
                 setTeams(relevantCompetition.teams || []);
                 competitionIdForLogs = relevantCompetition.id; // Use this ID for log filtering *if* needed
              } else {
                 setTeams([]); // No relevant competition found for team data
              }
        }

        // Fetch Logs based on determined criteria
        if ((startDate && endDate)) { // Only fetch if we have a valid date range
            const logsRef = collection(db, 'dailyAchievements');
            let logsQuery = query(
                logsRef,
                where('podId', '==', selectedPodId),
                where('date', '>=', Timestamp.fromDate(startDate)),
                where('date', '<=', Timestamp.fromDate(endDate))
            );
            // // Optionally filter by competition ID if timeframe is 'competition'
            // if (timeframe === 'competition' && competitionIdForLogs) {
            //     logsQuery = query(logsQuery, where('competitionId', '==', competitionIdForLogs));
            // }

            const logsSnapshot = await getDocs(logsQuery);
            const fetchedLogs = logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
            setAllLogs(fetchedLogs);
        } else if (timeframe !== 'competition'){
             setError("Invalid date range calculated.");
             setAllLogs([]);
        } else {
             setAllLogs([]); // No competition selected
        }

      } catch (err) {
        console.error("Error fetching leaderboard data:", err);
        setError("Failed to load leaderboard data.");
        setAgents([]);
        setTeams([]);
        setAllLogs([]);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
     // Dependencies: refetch when pod, selected date, timeframe, or selected competition change
  }, [selectedPodId, selectedDate, timeframe, selectedCompetitionId, competitions]);


  // 4. Calculate Leaderboard Scores
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
          ) : timeframe === 'competition' && !selectedCompetitionId ? (
             <p className="text-center text-muted-foreground mt-6">Please select a competition.</p>
          ) : (agents.length === 0 && !error) ? (
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
                   {agentLeaderboard.length === 0 ? (
                       <p className="text-muted-foreground text-center py-4">No data available for this period.</p>
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
                            <TableRow key={entry.id}>
                            <TableCell className="font-medium text-center">{entry.rank}</TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                     <Avatar className="h-7 w-7">
                                         {entry.avatarUrl ? (
                                            <AvatarImage src={entry.avatarUrl} alt={entry.name} />
                                         ) : (
                                             <AvatarFallback
                                                initials={entry.avatarInitials || generateInitials(entry.name)}
                                                backgroundColor={entry.avatarBgColor}
                                             >
                                                 {!entry.avatarInitials && generateInitials(entry.name)}
                                             </AvatarFallback>
                                         )}
                                     </Avatar>
                                     <span className="truncate">{entry.name}</span>
                                 </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-primary">
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
                    ) : teamLeaderboard.length === 0 ? (
                         <p className="text-muted-foreground text-center py-4">No data available for this period.</p>
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
                            <TableRow key={entry.id}>
                            <TableCell className="font-medium text-center">{entry.rank}</TableCell>
                            <TableCell className="font-medium">{entry.name}</TableCell>
                            <TableCell className="text-right font-semibold text-primary">
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
