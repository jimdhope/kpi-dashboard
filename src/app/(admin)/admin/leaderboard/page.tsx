
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
import { Loader2, AlertCircle, Trophy, Users, Medal, Filter } from 'lucide-react'; // Added Filter
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Leaderboard } from '@/components/leaderboard';
import type { TeamBonusLog } from '@/app/(admin)/admin/log-achievements/page';

interface Competition {
  id: string;
  name: string;
  startDate?: Timestamp;
  endDate?: Timestamp;
  podIds?: string[];
  rules?: Array<{
    id: string;
    name: string;
    emoji?: string;
    points: number;
  }>;
  teams?: Array<{
    id: string;
    name: string;
    agentIds: string[];
    emoji?: string;
  }>;
}

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
  loggedAt: Timestamp;
  loggedBy?: string | null;
  points?: number; // Add points to log
}

// Interface for leaderboard entries - Added agentFirstNames
interface LeaderboardEntry {
  id: string; // Can be agentId or teamId or podId
  name: string;
  score: number;
  rank?: number;
  avatarUrl?: string;
  avatarInitials?: string;
  avatarBgColor?: string;
  emoji?: string; // Add emoji for teams
  isUser?: boolean;
  isCurrentUserTeam?: boolean;
  agentFirstNames?: string[]; // Array of first names for team entries
}

// Team structure within Competition
interface Team {
  id: string;
  name: string;
  agentIds: string[];
  emoji?: string;
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
const teamBonusLogsCollectionRef = collection(db, 'teamBonusLogs');


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
  const [bonusLogs, setBonusLogs] = useState<TeamBonusLog[]>([]);
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


   // 4. Fetch Competition-Specific Data (Logs, Teams, Bonus Logs) and Listen
    useEffect(() => {
        if (!selectedCompetitionId) {
            setTeams([]);
            setAllLogs([]);
            setBonusLogs([]);
            setIsLoadingData(false);
            return () => {};
        }

        setIsLoadingData(true);
        setError(null);
        let unsubscribeLogs: Unsubscribe = () => {};
        let unsubscribeBonusLogs: Unsubscribe = () => {};

        const fetchCompetitionDataAndListen = async () => {
            try {
                const compDocRef = doc(competitionsCollectionRef, selectedCompetitionId);
                const compDocSnap = await getDoc(compDocRef);
                if (compDocSnap.exists()) {
                    const compData = compDocSnap.data() as Competition & { teams?: Team[] };
                    setTeams(compData.teams || []);
                } else {
                    setError("Selected competition data not found.");
                    setTeams([]);
                    setAllLogs([]);
                    setBonusLogs([]);
                    setIsLoadingData(false);
                    return;
                }

                let logsQuery = query(dailyAchievementsCollectionRef, where('competitionId', '==', selectedCompetitionId));
                let bonusLogsQuery = query(teamBonusLogsCollectionRef, where('competitionId', '==', selectedCompetitionId));

                if (selectedPodId) {
                    logsQuery = query(logsQuery, where('podId', '==', selectedPodId));
                    bonusLogsQuery = query(bonusLogsQuery, where('podId', '==', selectedPodId));
                }

                unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
                    setAllLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog)));
                    setIsLoadingData(false);
                }, (err) => {
                    console.error("Error listening to achievement logs:", err);
                    setError("Failed to load real-time leaderboard data.");
                    setIsLoadingData(false);
                });

                unsubscribeBonusLogs = onSnapshot(bonusLogsQuery, (snapshot) => {
                    setBonusLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamBonusLog)));
                }, (err) => {
                    console.error("Error listening to bonus logs:", err);
                    setError("Failed to load bonus points data.");
                });

            } catch (err) {
                console.error("Error fetching competition data:", err);
                setError("Failed to load competition-specific data.");
                setTeams([]); setAllLogs([]); setBonusLogs([]);
                setIsLoadingData(false);
            }
        };

        fetchCompetitionDataAndListen();

        return () => {
            unsubscribeLogs();
            unsubscribeBonusLogs();
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


    // 5. Calculate Leaderboard Scores (useMemo) - Updated to include bonusLogs
    const { agentLeaderboard, teamLeaderboard } = useMemo(() => {
        const competition = competitions.find(c => c.id === selectedCompetitionId);
        if (!competition) return { agentLeaderboard: [], teamLeaderboard: [] };

        const rulesMap = new Map((competition.rules || []).map(rule => [rule.id, rule]));

        const relevantAgents = selectedPodId
            ? agents.filter(agent => agent.podId === selectedPodId && agent.roles?.includes('agent'))
            : agents.filter(agent => agent.roles?.includes('agent') && participatingPods.some(p => p.id === agent.podId));

        const agentScores: Record<string, number> = {};
        relevantAgents.forEach(agent => { if(agent.id) agentScores[agent.id] = 0; });

        allLogs.forEach(log => {
            const points = log.points ?? (log.value || 0) * (rulesMap.get(log.ruleId)?.points || 0);
            if (agentScores.hasOwnProperty(log.agentId)) {
                agentScores[log.agentId] += points;
            }
        });

        const finalAgentLeaderboard: LeaderboardEntry[] = relevantAgents
            .map(agent => ({
                id: agent.id!,
                name: agent.name,
                score: agentScores[agent.id!] || 0,
                avatarUrl: agent.avatarUrl,
                avatarInitials: agent.avatarInitials,
                avatarBgColor: agent.avatarBgColor,
                isUser: agent.id === auth.currentUser?.uid,
            }));

        const teamScores: Record<string, number> = {};
        teams.forEach(team => { teamScores[team.id] = 0; });

        allLogs.forEach(log => {
            const points = log.points ?? (log.value || 0) * (rulesMap.get(log.ruleId)?.points || 0);
            const agentTeam = teams.find(team => team.agentIds?.includes(log.agentId));
            if (agentTeam && teamScores.hasOwnProperty(agentTeam.id)) {
                teamScores[agentTeam.id] += points;
            }
        });

        // Add bonus points to team scores
        bonusLogs.forEach(log => {
            if (teamScores.hasOwnProperty(log.teamId)) {
                teamScores[log.teamId] += log.points || 0;
            }
        });

        const finalTeamLeaderboard: LeaderboardEntry[] = teams
            .map(team => {
                const agentFirstNames = (team.agentIds || [])
                    .map(agentId => agents.find(a => a.id === agentId)?.name.split(' ')[0])
                    .filter((name): name is string => !!name)
                    .sort();

                return {
                    id: team.id,
                    name: team.name,
                    score: teamScores[team.id] || 0,
                    agentFirstNames: agentFirstNames,
                    emoji: team.emoji,
                    isUser: team.agentIds?.includes(auth.currentUser?.uid || ''),
                };
            });

        return { agentLeaderboard: finalAgentLeaderboard, teamLeaderboard: finalTeamLeaderboard };
    }, [allLogs, bonusLogs, agents, participatingPods, teams, selectedPodId, auth.currentUser?.uid, competitions, selectedCompetitionId]);


  const isLoading = isLoadingBase || isLoadingData;
  const competition = competitions.find(c => c.id === selectedCompetitionId);
  const currentUser = auth.currentUser; // Get current user for highlighting

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Filters Card */}
        <Card className="frosted-glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" /> Leaderboard Filters</CardTitle>
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
              <Leaderboard
                title="Agent Leaderboard"
                description={selectedPodId ? `Ranking for ${pods.find(p => p.id === selectedPodId)?.name || 'selected pod'}` : "Overall Agent Ranking"}
                entries={agentLeaderboard}
                isStickyHeader={false}
              />
              <Leaderboard
                title="Team Leaderboard"
                description={selectedPodId ? `Team ranking for ${pods.find(p => p.id === selectedPodId)?.name || 'selected pod'}` : "Overall Team Ranking"}
                entries={teamLeaderboard.map(t => ({...t, name: `${t.name}${t.agentFirstNames && t.agentFirstNames.length > 0 ? ` (${t.agentFirstNames.join(', ')})` : ''}`}))} // Append agent names to team name for display
                isStickyHeader={false}
              />
            </div>
        )}
      </div>
    </TooltipProvider>
  );
}
