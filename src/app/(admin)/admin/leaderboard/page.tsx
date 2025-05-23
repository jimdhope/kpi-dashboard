
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


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

// Interface for leaderboard entries - Added agentFirstNames
interface LeaderboardEntry {
  id: string; // Can be agentId or teamId or podId
  name: string;
  totalPoints: number;
  rank?: number;
  avatarUrl?: string; // Keep for data storage, but don't display image
  avatarInitials?: string;
  avatarBgColor?: string;
  isCurrentUser?: boolean;
  isCurrentUserTeam?: boolean;
  agentFirstNames?: string[]; // Array of first names for team entries
  score: number; // Added score for compatibility
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

const LEADERBOARD_COMPETITION_KEY = 'leaderboardPage_selectedCompetitionId';
const LEADERBOARD_POD_KEY = 'leaderboardPage_selectedPodId';

export default function AdminLeaderboardPage() {
  // State changes: removed timeframe/date, added selectedCompetitionId
  const [pods, setPods] = useState<Pod[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = React.useState<string>(''); // New state for competition selection
  const [selectedPodId, setSelectedPodId] = useState<string>(''); // Filter by pod within the competition
  const [competitions, setCompetitions] = useState<Competition[]>([]); // Store all competitions
  const [agents, setAgents] = useState<AppUser[]>([]); // All users, will filter by pod if needed
  const [teams, setTeams] = useState<Team[]>([]); // Teams for the selected competition
  const [allLogs, setAllLogs] = useState<DailyAchievementLog[]>([]);
  const [isLoadingBase, setIsLoadingBase] = useState(true); // Loading pods, users, competitions
  const [isLoadingData, setIsLoadingData] = useState(false); // Loading logs, teams
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Load saved filters from localStorage on mount
  React.useEffect(() => {
    const savedCompetitionId = localStorage.getItem(LEADERBOARD_COMPETITION_KEY);
    if (savedCompetitionId) {
        setSelectedCompetitionId(savedCompetitionId);
    }
    const savedPodId = localStorage.getItem(LEADERBOARD_POD_KEY);
    // This will be re-evaluated when competitions/pods load to ensure pod belongs to competition
    if (savedPodId) {
        setSelectedPodId(savedPodId);
    }
  }, []);

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


    // Dense Ranking Logic (1, 2, 2, 3...)
    const assignDenseRanks = <T extends { score: number }>(items: T[]): (T & { rank: number })[] => {
        if (items.length === 0) return [];

         const sortedItems = [...items].sort((a, b) => b.score - a.score);
         const scoreRankMap = new Map<number, number>();
         let rankCounter = 1;

         for (const item of sortedItems) {
             if (!scoreRankMap.has(item.score)) {
                 scoreRankMap.set(item.score, rankCounter++);
             }
         }
         return sortedItems.map(item => ({
             ...item,
             rank: scoreRankMap.get(item.score)!
         }));
    };

    // 5. Calculate Leaderboard Scores (useMemo)
    const { agentLeaderboard, teamLeaderboard } = useMemo(() => {
        // Filter agents based on selectedPodId if necessary
        const relevantAgents = selectedPodId
            ? agents.filter(agent => agent.podId === selectedPodId && agent.roles?.includes('agent'))
            : // If no pod filter, include agents from *all* pods participating in the competition
            agents.filter(agent => agent.roles?.includes('agent') && participatingPods.some(p => p.id === agent.podId));

        // Agent calculations
        const agentScores: Record<string, number> = {};
        // Initialize scores for ALL relevant agents, even if they have 0 points
        relevantAgents.forEach(agent => { if(agent.id) agentScores[agent.id] = 0; });

        // Aggregate points from allLogs.
        // Ensure allLogs contains ONLY logs relevant to the selected competition and pod filter (if any).
        // This should be handled by the onSnapshot query itself.
        allLogs.forEach(log => {
            const points = typeof log.points === 'number' ? log.points : 0;
            if (agentScores.hasOwnProperty(log.agentId)) {
                agentScores[log.agentId] += points;
            }
        });

        const agentLeaderboardData = relevantAgents
            .map(agent => ({
                id: agent.id!,
                name: agent.name,
                totalPoints: agentScores[agent.id!] || 0,
                score: agentScores[agent.id!] || 0, 
                avatarUrl: agent.avatarUrl,
                avatarInitials: agent.avatarInitials,
                avatarBgColor: agent.avatarBgColor,
                isCurrentUser: agent.id === auth.currentUser?.uid,
            }))
            .sort((a, b) => b.totalPoints - a.totalPoints); 


        const finalAgentLeaderboard = assignDenseRanks(agentLeaderboardData);


        // Team calculations
        const teamScores: Record<string, number> = {};
        teams.forEach(team => { teamScores[team.id] = 0; });

        allLogs.forEach(log => {
            const points = typeof log.points === 'number' ? log.points : 0;
            const agentTeam = teams.find(team => team.agentIds?.includes(log.agentId));
            if (agentTeam && teamScores.hasOwnProperty(agentTeam.id)) {
                teamScores[agentTeam.id] += points;
            }
        });

        const teamLeaderboardData = teams
            .map(team => {
                const agentFirstNames = (team.agentIds || [])
                    .map(agentId => agents.find(a => a.id === agentId)?.name.split(' ')[0])
                    .filter((name): name is string => !!name)
                    .sort();

                return {
                    id: team.id,
                    name: team.name,
                    totalPoints: teamScores[team.id] || 0,
                    score: teamScores[team.id] || 0, 
                    agentFirstNames: agentFirstNames,
                    isCurrentUserTeam: team.agentIds?.includes(auth.currentUser?.uid || ''),
                };
            })
           .sort((a, b) => b.totalPoints - a.totalPoints); 

        const finalTeamLeaderboard = assignDenseRanks(teamLeaderboardData);


        return { agentLeaderboard: finalAgentLeaderboard, teamLeaderboard: finalTeamLeaderboard };
    }, [allLogs, agents, participatingPods, teams, selectedPodId, auth.currentUser?.uid]);


  const isLoading = isLoadingBase || isLoadingData;
  const competition = competitions.find(c => c.id === selectedCompetitionId);
  const currentUser = auth.currentUser; // Get current user for highlighting

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Filters Card */}
        <Card className="frosted-glass">
          <CardHeader>
            <CardTitle>Leaderboard Filters</CardTitle>
            <CardDescription>Select a competition and optionally filter by pod.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              {/* Competition Select */}
              <div className="grid gap-2">
                <Label htmlFor="competition-select">Competition</Label>
                <Select
                  onValueChange={(value) => {
                      setSelectedCompetitionId(value);
                      localStorage.setItem(LEADERBOARD_COMPETITION_KEY, value);
                      setSelectedPodId(''); // Reset pod when competition changes
                      localStorage.removeItem(LEADERBOARD_POD_KEY);
                  }}
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
                  onValueChange={(value) => {
                      const newPodId = value === 'all' ? '' : value;
                      setSelectedPodId(newPodId);
                      if (newPodId) {
                        localStorage.setItem(LEADERBOARD_POD_KEY, newPodId);
                      } else {
                        localStorage.removeItem(LEADERBOARD_POD_KEY);
                      }
                  }}
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
          </CardContent>
        </Card>

        {error && <p className="text-destructive mb-4">{error}</p>}

        {/* Leaderboard Display Area */}
        {!selectedCompetitionId && !isLoadingBase && (
            <p className="text-muted-foreground text-center py-4">Please select a competition to view leaderboards.</p>
        )}

        {selectedCompetitionId && isLoading ? (
            <div className="grid md:grid-cols-2 gap-6">
                <Skeleton className="h-[400px] w-full frosted-glass" />
                <Skeleton className="h-[400px] w-full frosted-glass" />
            </div>
        ) : selectedCompetitionId && !isLoading && (
            <div className="grid md:grid-cols-2 gap-6">
            {/* Agent Leaderboard Card */}
            <Card className="frosted-glass">
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
                                            <AvatarFallback
                                                initials={entry.avatarInitials || generateInitials(entry.name)}
                                                backgroundColor={entry.avatarBgColor}
                                                className={cn((entry.rank ?? 0) <= 3 ? 'text-gray-900' : '')}
                                            >
                                                {!entry.avatarInitials && generateInitials(entry.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className={cn("truncate", (entry.rank ?? 0) <= 3 ? 'text-white' : '')}>{entry.name}</span>
                                        {entry.isCurrentUser && <Badge variant={(entry.rank ?? 0) <= 3 ? "secondary" : "outline"} className={cn("ml-2", (entry.rank ?? 0) <= 3 ? "border-white/50 text-white/90" : "")}>You</Badge>}
                                    </div>
                                </TableCell>
                                <TableCell className={cn("text-right font-semibold", (entry.rank ?? 0) <= 3 ? 'text-white' : 'text-primary')}>
                                    {(entry.totalPoints ?? 0).toLocaleString()}
                                </TableCell>
                                </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                    )}
                </CardContent>
            </Card>

            {/* Team Leaderboard Card */}
            <Card className="frosted-glass">
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
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-1">
                                            <span className="font-semibold">{entry.name}</span>
                                            {entry.isCurrentUserTeam && <Badge variant={(entry.rank ?? 0) <= 3 ? "secondary" : "outline"} className={cn("ml-2", (entry.rank ?? 0) <= 3 ? "border-white/50 text-white/90" : "")}>Your Team</Badge>}
                                        </div>
                                        {entry.agentFirstNames && entry.agentFirstNames.length > 0 && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className={cn("text-xs cursor-help", (entry.rank ?? 0) <= 3 ? 'text-white/80' : 'text-muted-foreground')}>
                                                        {entry.agentFirstNames.join(', ')}
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Team Members: {entry.agentFirstNames.join(', ')}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className={cn("text-right font-semibold", (entry.rank ?? 0) <= 3 ? 'text-white' : 'text-primary')}>
                                    {(entry.totalPoints ?? 0).toLocaleString()}
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
      </div>
    </TooltipProvider>
  );
}
