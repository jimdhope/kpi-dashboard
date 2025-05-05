
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, // Import collection
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
import { db, auth } from '@/lib/firebase'; // Import db
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, Trophy, Users, Medal } from 'lucide-react';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
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
  id: string; // Can be agentId or teamId
  name: string;
  totalPoints: number;
  rank?: number;
  avatarUrl?: string;
  avatarInitials?: string;
  avatarBgColor?: string;
  isCurrentUser?: boolean;
  isCurrentUserTeam?: boolean;
}

// Team structure within Competition
interface Team {
  id: string;
  name: string;
  agentIds: string[];
}

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

// Define collection references
const podsCollectionRef = collection(db, 'pods');
const usersCollectionRef = collection(db, 'users');
const competitionsCollectionRef = collection(db, 'competitions');
const dailyAchievementsCollectionRef = collection(db, 'dailyAchievements');

export default function AdminLeaderboardPage() {
  // State changes: removed timeframe/date, added selectedCompetitionId
  const [pods, setPods] = useState<Pod[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>(''); // New state for competition selection
  const [selectedPodId, setSelectedPodId] = useState<string>(''); // Filter by pod within the competition
  const [competitions, setCompetitions] = useState<Competition[]>([]); // Store all competitions
  const [agents, setAgents] = useState<AppUser[]>([]); // All users, will filter by pod if needed
  const [teams, setTeams] = useState<Team[]>([]); // Teams for the selected competition
  const [allLogs, setAllLogs] = useState<DailyAchievementLog[]>([]);
  const [isLoadingBase, setIsLoadingBase] = useState(true); // Loading pods, users, competitions
  const [isLoadingData, setIsLoadingData] = useState(false); // Loading logs, teams
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // 1. Fetch Base Data (Pods, Users, Competitions) - Use onSnapshot for potential updates
  useEffect(() => {
    setIsLoadingBase(true);
    setError(null);
    const unsubscribes: Unsubscribe[] = [];
    let isMounted = true;

    const fetchBaseData = async () => {
      try {
        // Fetch Pods
        const podsQuery = query(podsCollectionRef, orderBy('name'));
        unsubscribes.push(onSnapshot(podsQuery, (snapshot) => {
          if (!isMounted) return;
          setPods(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pod)));
        }, err => { if (isMounted) { console.error("Error fetching pods:", err); setError(prev => prev ?? "Failed to load pods."); } }));

        // Fetch Users
        const usersQuery = query(usersCollectionRef, orderBy('name'));
        unsubscribes.push(onSnapshot(usersQuery, (snapshot) => {
          if (!isMounted) return;
          setAgents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)));
        }, err => { if (isMounted) { console.error("Error fetching users:", err); setError(prev => prev ?? "Failed to load users."); } }));

        // Fetch Competitions
        const compQuery = query(competitionsCollectionRef, orderBy('startDate', 'desc'));
        unsubscribes.push(onSnapshot(compQuery, (snapshot) => {
           if (!isMounted) return;
          setCompetitions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Competition)));
          setIsLoadingBase(false); // Mark base loading complete after competitions
        }, err => { if (isMounted) { console.error("Error fetching competitions:", err); setError(prev => prev ?? "Failed to load competitions."); setIsLoadingBase(false); } }));

      } catch (err) {
        if (isMounted) {
          console.error("Error fetching base data:", err);
          setError("Failed to load necessary data.");
          setIsLoadingBase(false);
        }
      }
    };

    fetchBaseData();

    return () => {
      isMounted = false;
      unsubscribes.forEach(unsub => unsub());
    };
  }, []);


   // 4. Fetch Competition-Specific Data (Logs, Teams) and Listen to Logs
  useEffect(() => {
    if (!selectedCompetitionId) {
        setTeams([]);
        setAllLogs([]);
        setIsLoadingData(false); // Not loading if no competition selected
        return () => {}; // Return empty cleanup
    }

    setIsLoadingData(true);
    setError(null);
    let unsubscribeLogs: Unsubscribe = () => {};

    const fetchCompetitionDataAndListen = async () => {
        try {
            // Fetch Teams for the selected competition
            const compDocRef = doc(competitionsCollectionRef, selectedCompetitionId);
            const compDocSnap = await getDoc(compDocRef);
            if (compDocSnap.exists()) {
                 const compData = compDocSnap.data() as Competition & { teams?: Team[] };
                 setTeams(compData.teams || []);
            } else {
                setError("Selected competition data not found.");
                 setTeams([]);
                 setAllLogs([]);
                 setIsLoadingData(false);
                 return;
            }

            // Listen to Logs for the specific competition
            let logsQuery = query(dailyAchievementsCollectionRef, where('competitionId', '==', selectedCompetitionId));

            // Apply pod filter if selected
            if (selectedPodId) {
                logsQuery = query(logsQuery, where('podId', '==', selectedPodId));
            }

            unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
                const fetchedLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
                setAllLogs(fetchedLogs);
                setIsLoadingData(false); // Data loaded
                setError(null);
            }, (err) => {
                console.error("Error listening to achievement logs for competition:", err);
                setError("Failed to load real-time leaderboard data.");
                setAllLogs([]);
                setIsLoadingData(false);
            });

        } catch (err) {
            console.error("Error fetching competition data:", err);
            setError("Failed to load competition-specific data.");
            setTeams([]);
            setAllLogs([]);
            setIsLoadingData(false);
        }
    };

    fetchCompetitionDataAndListen();

    // Cleanup function for the logs listener
    return () => {
        console.log("Unsubscribing from competition leaderboard logs listener");
        unsubscribeLogs();
    };
  }, [selectedCompetitionId, selectedPodId]);

   // --- Memoized Derived Data ---

    // Pods participating in the selected competition
    const participatingPods = useMemo(() => {
        if (!selectedCompetitionId) return [];
        const competition = competitions.find(c => c.id === selectedCompetitionId);
        if (!competition || !competition.podIds) return [];
        return pods.filter(pod => competition.podIds.includes(pod.id));
    }, [competitions, pods, selectedCompetitionId]);


  // 5. Calculate Leaderboard Scores (useMemo)
  const { agentLeaderboard, teamLeaderboard } = useMemo(() => {
      // Filter agents based on selectedPodId if necessary
      const relevantAgents = selectedPodId
          ? agents.filter(agent => agent.podId === selectedPodId && agent.roles?.includes('agent'))
          : // If no pod filter, include agents from *all* pods participating in the competition
            agents.filter(agent => agent.roles?.includes('agent') && participatingPods.some(p => p.id === agent.podId));


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
              // isCurrentUser: agent.id === currentUser?.id, // Add if needed later
          }))
          // Removed filter: .filter(entry => entry.totalPoints > 0)
          .sort((a, b) => b.totalPoints - a.totalPoints)
          .map((entry, index) => ({ ...entry, rank: index + 1 }));

      // Team calculations - uses the `teams` state fetched for the competition
      const teamScores: Record<string, number> = {};
       teams.forEach(team => { teamScores[team.id] = 0; });

       allLogs.forEach(log => {
            // Ensure log points are valid
            const points = typeof log.points === 'number' ? log.points : 0;

           // Find the team the agent belongs to *within the competition's teams*
            const agentTeam = teams.find(team => team.agentIds?.includes(log.agentId));
             if (agentTeam && teamScores.hasOwnProperty(agentTeam.id)) {
                 teamScores[agentTeam.id] += points;
             }
       });


       const finalTeamLeaderboard: LeaderboardEntry[] = teams
           .map(team => ({
              id: team.id,
              name: team.name,
              totalPoints: teamScores[team.id] || 0,
              // isCurrentUserTeam: team.agentIds?.includes(currentUser?.id || ''), // Add if needed later
           }))
           // Removed filter: .filter(entry => entry.totalPoints > 0)
           .sort((a, b) => b.totalPoints - a.totalPoints)
           .map((entry, index) => ({ ...entry, rank: index + 1 }));

      return { agentLeaderboard: finalAgentLeaderboard, teamLeaderboard: finalTeamLeaderboard };
   // Dependencies: logs, filtered agents, competition teams
  }, [allLogs, agents, participatingPods, teams, selectedPodId]);

  const isLoading = isLoadingBase || isLoadingData;
  const competition = competitions.find(c => c.id === selectedCompetitionId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Competition Leaderboards</CardTitle>
          <CardDescription>View agent and team rankings for a specific competition.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Selection Controls */}
          <div className="flex flex-wrap gap-4 mb-6 items-end">
            {/* Competition Select */}
            <div className="grid gap-2">
              <Label htmlFor="competition-select">Competition</Label>
              <Select
                onValueChange={(value) => { setSelectedCompetitionId(value); setSelectedPodId(''); /* Reset pod filter */ }}
                value={selectedCompetitionId}
                disabled={isLoadingBase}
              >
                <SelectTrigger id="competition-select" className="w-[250px]">
                  <SelectValue placeholder={isLoadingBase ? "Loading..." : "Select Competition"} />
                </SelectTrigger>
                <SelectContent>
                  {competitions.length === 0 && !isLoadingBase && <SelectItem value="-" disabled>No competitions found</SelectItem>}
                  {competitions.map(comp => (
                    <SelectItem key={comp.id} value={comp.id}>{comp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pod Filter Select (Optional) */}
            <div className="grid gap-2">
              <Label htmlFor="pod-filter-select">Filter by Pod (Optional)</Label>
              <Select
                onValueChange={(value) => setSelectedPodId(value === 'all' ? '' : value)}
                value={selectedPodId || 'all'}
                disabled={isLoading || !selectedCompetitionId || participatingPods.length === 0}
              >
                <SelectTrigger id="pod-filter-select" className="w-[200px]">
                  <SelectValue placeholder={!selectedCompetitionId ? "Select competition first" : (participatingPods.length === 0 ? "No pods" : "All Pods")} />
                </SelectTrigger>
                <SelectContent>
                   {!selectedCompetitionId ? (
                       <SelectItem value="-" disabled>Select competition first</SelectItem>
                   ) : participatingPods.length === 0 ? (
                       <SelectItem value="-" disabled>No pods in competition</SelectItem>
                   ) : (
                     <>
                       <SelectItem value="all">All Pods</SelectItem>
                       {participatingPods.map(pod => (
                         <SelectItem key={pod.id} value={pod.id}>{pod.name}</SelectItem>
                       ))}
                     </>
                   )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && <p className="text-destructive mb-4">{error}</p>}

          {/* Leaderboard Display */}
          {!selectedCompetitionId && !isLoadingBase && (
            <p className="text-muted-foreground text-center py-4">Please select a competition to view leaderboards.</p>
          )}

          {selectedCompetitionId && isLoading ? (
            <div className="grid md:grid-cols-2 gap-6">
                <Skeleton className="h-[400px] w-full" />
                <Skeleton className="h-[400px] w-full" />
            </div>
          ) : selectedCompetitionId && !isLoading && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Agent Leaderboard */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg font-semibold">Agent Leaderboard</CardTitle>
                     <Users className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                   {agentLeaderboard.length === 0 ? (
                       <p className="text-muted-foreground text-center py-4">No agent data available for this {selectedPodId ? `pod in this competition` : `competition`}.</p>
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
                                    entry.isCurrentUser && (entry.rank ?? 0) > 3 ? 'bg-accent' : '',
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
                         <p className="text-muted-foreground text-center py-4">No teams defined for this competition.</p>
                     ) : teamLeaderboard.length === 0 ? (
                         <p className="text-muted-foreground text-center py-4">No team score data available for this {selectedPodId ? `pod in this competition` : `competition`}.</p>
                     ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>{/* Remove whitespace here */}
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
                                        entry.isCurrentUserTeam && (entry.rank ?? 0) > 3 ? 'bg-accent' : '',
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

    