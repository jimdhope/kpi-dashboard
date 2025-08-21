
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
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, Trophy, Users, Filter } from 'lucide-react';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Leaderboard } from '@/components/leaderboard';
import { startOfDay } from 'date-fns';

// Interface for daily achievement logs
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

// Team structure within Competition
interface Team {
  id: string;
  name: string;
  agentIds: string[];
}

const assignDenseRanks = <T extends { score: number }>(items: T[]): (T & { rank: number })[] => {
    if (items.length === 0) return [];
    const sortedItems = [...items].sort((a, b) => b.score - a.score);
    let currentRank = 0;
    let lastScore = Infinity;
    const rankedItems = sortedItems.map((item) => {
        if (item.score < lastScore) {
            currentRank++;
        }
        lastScore = item.score;
        return { ...item, rank: currentRank };
    });
    return rankedItems;
};

const AGENT_LEADERBOARD_COMP_KEY = 'agentLeaderboard_selectedCompetitionId';

export default function AgentLeaderboardPage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [podAgents, setPodAgents] = useState<AppUser[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [allLogs, setAllLogs] = useState<DailyAchievementLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // 1. Fetch current user data
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'users', auth.currentUser!.uid), (doc) => {
        if (doc.exists()) {
            setCurrentUser({ id: doc.id, ...doc.data() } as AppUser);
        } else {
            setError("Could not find your user profile.");
            toast({ variant: "destructive", title: "Error", description: "Your user profile could not be loaded." });
        }
    }, (err) => {
        console.error("Error fetching current user:", err);
        setError("Failed to load your profile.");
    });
    return () => unsubscribe();
  }, [toast]);

  // 2. Fetch all competitions the user's pod is part of
  useEffect(() => {
    if (!currentUser?.podId) return;
    setIsLoading(true);

    const compQuery = query(
        collection(db, 'competitions'),
        where('podIds', 'array-contains', currentUser.podId),
        orderBy('startDate', 'desc')
    );

    const unsubscribe = onSnapshot(compQuery, (snapshot) => {
        const fetchedComps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Competition));
        setCompetitions(fetchedComps);
        
        // Set default competition if not already set by localStorage
        const savedCompId = localStorage.getItem(AGENT_LEADERBOARD_COMP_KEY);
        if (savedCompId && fetchedComps.some(c => c.id === savedCompId)) {
            setSelectedCompetitionId(savedCompId);
        } else if (fetchedComps.length > 0 && !selectedCompetitionId) {
            const latestActiveComp = fetchedComps.find(c => c.endDate.toDate() >= startOfDay(new Date())) || fetchedComps[0];
            setSelectedCompetitionId(latestActiveComp.id);
        }
        setIsLoading(false);
    }, (err) => {
        console.error("Error fetching competitions:", err);
        setError("Failed to load competitions.");
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser?.podId, selectedCompetitionId]);


  // 3. Fetch agents, teams, and logs for the selected competition and pod
  useEffect(() => {
    if (!selectedCompetitionId || !currentUser?.podId) {
        setPodAgents([]);
        setTeams([]);
        setAllLogs([]);
        return;
    }
    setIsLoadingData(true);
    const unsubscribes: Unsubscribe[] = [];

    const fetchCompetitionData = async () => {
        try {
            // Fetch agents in the pod
            const agentsQuery = query(collection(db, 'users'), where('podId', '==', currentUser.podId));
            unsubscribes.push(onSnapshot(agentsQuery, (snap) => {
                setPodAgents(snap.docs.map(d => ({id: d.id, ...d.data()} as AppUser)));
            }));
            
            // Fetch teams from competition doc
            const compDocRef = doc(collection(db, 'competitions'), selectedCompetitionId);
            unsubscribes.push(onSnapshot(compDocRef, (snap) => {
                if (snap.exists()) {
                    const compData = snap.data() as Competition & { teams?: Team[] };
                    setTeams(compData.teams || []);
                }
            }));
            
            // Fetch all logs for this pod in this competition
            const logsQuery = query(
                collection(db, 'dailyAchievements'), 
                where('competitionId', '==', selectedCompetitionId), 
                where('podId', '==', currentUser.podId)
            );
            unsubscribes.push(onSnapshot(logsQuery, (snap) => {
                setAllLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyAchievementLog)));
                setIsLoadingData(false);
            }));
        } catch (err) {
            console.error("Error fetching competition data:", err);
            setError("Failed to load leaderboard data.");
            setIsLoadingData(false);
        }
    };
    fetchCompetitionData();

    return () => unsubscribes.forEach(unsub => unsub());
  }, [selectedCompetitionId, currentUser?.podId]);

  // 4. Memoize leaderboard calculations
  const { agentLeaderboard, teamLeaderboard } = useMemo(() => {
    if (!selectedCompetitionId || !currentUser?.podId) return { agentLeaderboard: [], teamLeaderboard: [] };
    const competition = competitions.find(c => c.id === selectedCompetitionId);
    if (!competition) return { agentLeaderboard: [], teamLeaderboard: [] };

    const rulesMap = new Map((competition.rules || []).map(rule => [rule.id, rule]));

    const agentScores: Record<string, number> = {};
    podAgents.forEach(agent => { if(agent.id) agentScores[agent.id] = 0; });
    allLogs.forEach(log => {
      const rule = rulesMap.get(log.ruleId);
      if (rule) {
        const points = (log.value || 0) * (rule.points || 0);
        if (agentScores.hasOwnProperty(log.agentId)) {
          agentScores[log.agentId] += points;
        }
      }
    });

    const finalAgentLeaderboard = assignDenseRanks(
        podAgents.map(agent => ({
            id: agent.id!,
            name: agent.name,
            totalPoints: agentScores[agent.id!] || 0,
            score: agentScores[agent.id!] || 0,
            avatarUrl: agent.avatarUrl,
            avatarInitials: agent.avatarInitials,
            avatarBgColor: agent.avatarBgColor,
            isCurrentUser: agent.id === currentUser?.id,
        }))
    );

    const teamScores: Record<string, number> = {};
    teams.forEach(team => { teamScores[team.id] = 0; });
    allLogs.forEach(log => {
      const rule = rulesMap.get(log.ruleId);
      if (rule) {
        const points = (log.value || 0) * (rule.points || 0);
        const agentTeam = teams.find(team => team.agentIds?.includes(log.agentId));
        if (agentTeam && teamScores.hasOwnProperty(agentTeam.id)) {
          teamScores[agentTeam.id] += points;
        }
      }
    });
    
    const finalTeamLeaderboard = assignDenseRanks(
        teams.map(team => ({
            id: team.id,
            name: team.name,
            totalPoints: teamScores[team.id] || 0,
            score: teamScores[team.id] || 0,
            isCurrentUserTeam: team.agentIds?.includes(currentUser?.id || ''),
        }))
    );

    return { agentLeaderboard: finalAgentLeaderboard, teamLeaderboard: finalTeamLeaderboard };
  }, [allLogs, podAgents, teams, competitions, selectedCompetitionId, currentUser]);
  
  const showLoading = isLoading || isLoadingData;
  const competitionName = competitions.find(c => c.id === selectedCompetitionId)?.name;

  return (
    <div className="space-y-6">
      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" /> Leaderboard</CardTitle>
          <CardDescription>View your individual and team rankings for the selected competition.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 max-w-sm">
            <Label htmlFor="competition-select">Competition</Label>
            <Select
              onValueChange={(value) => {
                  setSelectedCompetitionId(value);
                  localStorage.setItem(AGENT_LEADERBOARD_COMP_KEY, value);
              }}
              value={selectedCompetitionId}
              disabled={isLoading || competitions.length === 0}
            >
              <SelectTrigger id="competition-select">
                <SelectValue placeholder={isLoading ? "Loading..." : "Select Competition"} />
              </SelectTrigger>
              <SelectContent>
                {competitions.map(comp => (
                  <SelectItem key={comp.id} value={comp.id}>{comp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      {error && <p className="text-destructive mb-4">{error}</p>}
      
      {showLoading ? (
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-[400px] w-full frosted-glass" />
          <Skeleton className="h-[400px] w-full frosted-glass" />
        </div>
      ) : !selectedCompetitionId ? (
          <p className="text-muted-foreground text-center py-4">Please select a competition to view the leaderboards.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
            <Leaderboard
            title="Agent Leaderboard"
            description={`Ranking for competition: ${competitionName}`}
            entries={agentLeaderboard}
            isStickyHeader={false}
            />
            <Leaderboard
            title="Team Leaderboard"
            description={`Ranking for competition: ${competitionName}`}
            entries={teamLeaderboard}
            isStickyHeader={false}
            />
        </div>
      )}
    </div>
  );
}
